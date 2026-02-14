#!/usr/bin/env php
<?php

declare(strict_types=1);

$projectRoot = dirname(__DIR__);
$loggingModule = $projectRoot . '/snippets/agent/logging.php';
if (is_readable($loggingModule)) {
    require_once $loggingModule;
}

$opts = getopt('', ['input-dir:', 'output-dir:', 'since:', 'until:', 'include-errors:']);

$inputDir = $opts['input-dir'] ?? ($projectRoot . '/storage/agent-logs');
$outputDir = $opts['output-dir'] ?? ($projectRoot . '/storage/agent-logs/exports');
$since = $opts['since'] ?? '';
$until = $opts['until'] ?? '';
$includeErrors = isset($opts['include-errors']) && in_array((string)$opts['include-errors'], ['1', 'true', 'yes'], true);

if (!is_dir($inputDir)) {
    fwrite(STDERR, "Input-Verzeichnis nicht gefunden: {$inputDir}\n");
    exit(1);
}
if (!is_dir($outputDir) && !mkdir($outputDir, 0775, true) && !is_dir($outputDir)) {
    fwrite(STDERR, "Output-Verzeichnis konnte nicht erstellt werden: {$outputDir}\n");
    exit(1);
}

$sinceDate = null;
if ($since !== '') {
    $sinceDate = DateTimeImmutable::createFromFormat('Y-m-d', $since) ?: null;
    if (!$sinceDate) {
        fwrite(STDERR, "--since muss Format YYYY-MM-DD haben.\n");
        exit(1);
    }
}

$untilDate = null;
if ($until !== '') {
    $untilDate = DateTimeImmutable::createFromFormat('Y-m-d', $until) ?: null;
    if (!$untilDate) {
        fwrite(STDERR, "--until muss Format YYYY-MM-DD haben.\n");
        exit(1);
    }
}

$files = glob(rtrim($inputDir, '/') . '/events-*.jsonl') ?: [];
sort($files);

$timestamp = gmdate('Ymd-His');
$openAiOut = rtrim($outputDir, '/') . '/agent-openai-' . $timestamp . '.jsonl';
$ragOut = rtrim($outputDir, '/') . '/agent-rag-' . $timestamp . '.jsonl';

$openAiCount = 0;
$ragCount = 0;
$lineCount = 0;

$openAiHandle = fopen($openAiOut, 'wb');
$ragHandle = fopen($ragOut, 'wb');
if ($openAiHandle === false || $ragHandle === false) {
    fwrite(STDERR, "Konnte Output-Dateien nicht oeffnen.\n");
    exit(1);
}

foreach ($files as $file) {
    if (!is_file($file)) {
        continue;
    }
    $handle = fopen($file, 'rb');
    if ($handle === false) {
        continue;
    }

    while (($line = fgets($handle)) !== false) {
        $lineCount++;
        $line = trim($line);
        if ($line === '') {
            continue;
        }

        $record = json_decode($line, true);
        if (!is_array($record)) {
            continue;
        }
        if (($record['event'] ?? '') !== 'agent_chat') {
            continue;
        }
        if (!record_in_date_range($record, $sinceDate, $untilDate)) {
            continue;
        }

        $outcome = (string)($record['outcome'] ?? '');
        if ($outcome !== 'success' && !$includeErrors) {
            continue;
        }

        $messages = $record['openai_request']['messages'] ?? [];
        $assistantRaw = trim((string)($record['assistant_raw'] ?? ''));
        if (!is_array($messages) || count($messages) < 2 || $assistantRaw === '') {
            continue;
        }

        $openAiRow = [
            'messages' => [
                [
                    'role' => (string)($messages[0]['role'] ?? 'system'),
                    'content' => (string)($messages[0]['content'] ?? ''),
                ],
                [
                    'role' => (string)($messages[1]['role'] ?? 'user'),
                    'content' => (string)($messages[1]['content'] ?? ''),
                ],
                [
                    'role' => 'assistant',
                    'content' => $assistantRaw,
                ],
            ],
            'metadata' => [
                'log_id' => (string)($record['log_id'] ?? ''),
                'outcome' => $outcome,
                'http_status' => (int)($record['http_status'] ?? 0),
                'user_id' => $record['user']['id'] ?? null,
            ],
        ];
        fwrite($openAiHandle, safe_json($openAiRow) . "\n");
        $openAiCount++;

        $ragRow = [
            'id' => (string)($record['log_id'] ?? ''),
            'timestamp' => (string)($record['logged_at_utc'] ?? ''),
            'user_id' => $record['user']['id'] ?? null,
            'prompt' => (string)($record['prompt'] ?? ''),
            'normalized_prompt' => (string)($record['normalized_prompt'] ?? ''),
            'context' => is_array($record['context'] ?? null) ? $record['context'] : [],
            'assistant' => is_array($record['assistant_parsed'] ?? null)
                ? $record['assistant_parsed']
                : ['raw' => $assistantRaw],
            'outcome' => $outcome,
        ];
        fwrite($ragHandle, safe_json($ragRow) . "\n");
        $ragCount++;
    }

    fclose($handle);
}

fclose($openAiHandle);
fclose($ragHandle);

fwrite(STDOUT, "Verarbeitete Zeilen: {$lineCount}\n");
fwrite(STDOUT, "OpenAI JSONL: {$openAiCount} -> {$openAiOut}\n");
fwrite(STDOUT, "RAG JSONL: {$ragCount} -> {$ragOut}\n");
exit(0);

function record_in_date_range(array $record, ?DateTimeImmutable $since, ?DateTimeImmutable $until): bool
{
    $stamp = (string)($record['logged_at_utc'] ?? $record['started_at_utc'] ?? '');
    if ($stamp === '') {
        return true;
    }
    try {
        $date = new DateTimeImmutable($stamp);
    } catch (Throwable $e) {
        return true;
    }

    if ($since instanceof DateTimeImmutable && $date < $since->setTime(0, 0, 0)) {
        return false;
    }
    if ($until instanceof DateTimeImmutable && $date > $until->setTime(23, 59, 59)) {
        return false;
    }
    return true;
}

function safe_json($value): string
{
    $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return is_string($encoded) ? $encoded : '{}';
}
