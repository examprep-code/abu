<?php

$agentLoggingModule = dirname(__DIR__) . '/snippets/agent/logging.php';
if (is_readable($agentLoggingModule)) {
    include_once $agentLoggingModule;
}

$agentLogConfig = function_exists('agent_logger_config')
    ? agent_logger_config()
    : ['enabled' => false];
$agentLogStartedAt = microtime(true);
$agentLogWritten = false;
$agentLogRecord = [
    'event' => 'agent_chat',
    'route' => 'agent',
    'request_method' => (string)$method,
    'request_payload' => is_array($data ?? null) ? $data : [],
    'user' => [
        'id' => $user['id'] ?? null,
    ],
    'started_at_utc' => gmdate('c'),
];

$agentFinalizeLog = function ($outcome, $extra = []) use (&$agentLogWritten, &$agentLogRecord, $agentLogConfig, $agentLogStartedAt, &$return) {
    if ($agentLogWritten) {
        return;
    }
    $agentLogWritten = true;
    $agentLogRecord['outcome'] = (string)$outcome;
    $agentLogRecord['duration_ms'] = (int)round((microtime(true) - $agentLogStartedAt) * 1000);
    $agentLogRecord['finished_at_utc'] = gmdate('c');
    if (is_array($extra) && !empty($extra)) {
        foreach ($extra as $key => $value) {
            $agentLogRecord[$key] = $value;
        }
    }
    if (function_exists('agent_log_append_record')) {
        $logId = agent_log_append_record($agentLogRecord, $agentLogConfig);
        if (is_string($logId) && $logId !== '') {
            $return['log']['agent_log_id'] = $logId;
        }
    }
};

if (!isset($user['id'])) {
    $return['status'] = 401;
    warning('nicht eingeloggt');
    $agentFinalizeLog('unauthorized', [
        'http_status' => 401,
        'warning' => 'nicht eingeloggt',
    ]);
    return;
}

if ($method !== 'POST') {
    $return['status'] = 405;
    warning('nur POST erlaubt');
    $agentFinalizeLog('invalid_method', [
        'http_status' => 405,
        'warning' => 'nur POST erlaubt',
    ]);
    return;
}

include_once 'datian-core/agent_behavior.php';

$apiKey = getenv('OPENAI_API_KEY') ?: (defined('OPENAI_API_KEY') ? OPENAI_API_KEY : '');
if (!$apiKey) {
    $return['status'] = 500;
    warning('Kein OpenAI API-Key im Backend gesetzt.');
    $agentFinalizeLog('misconfigured', [
        'http_status' => 500,
        'warning' => 'Kein OpenAI API-Key im Backend gesetzt.',
    ]);
    return;
}

$prompt = trim((string)($data['prompt'] ?? ''));
$promptSchema = is_array($data['prompt_schema'] ?? null) ? $data['prompt_schema'] : [];
$context = is_array($data['context'] ?? null) ? $data['context'] : [];
$notesPath = dirname(__DIR__) . '/AGENT_README.md';

$agentLogRecord['prompt'] = $prompt;
$agentLogRecord['prompt_schema'] = $promptSchema;
$agentLogRecord['context'] = $context;

$modelInput = agent_build_model_messages($prompt, $promptSchema, $context, $notesPath);
$agentLogRecord['model_input'] = $modelInput;
if (!empty($modelInput['error'])) {
    $return['status'] = (int)($modelInput['status'] ?? 400);
    warning((string)$modelInput['error']);
    $agentFinalizeLog('invalid_request', [
        'http_status' => $return['status'],
        'warning' => (string)$modelInput['error'],
    ]);
    return;
}

$body = json_encode([
    'model' => 'gpt-4.1-mini',
    'messages' => $modelInput['messages'],
    'temperature' => 0.1,
    'response_format' => [
        'type' => 'json_object',
    ],
]);

$agentLogRecord['request_schema'] = $modelInput['request_schema'] ?? [];
$agentLogRecord['normalized_prompt'] = (string)($modelInput['normalized_prompt'] ?? '');
$agentLogRecord['openai_request'] = [
    'model' => 'gpt-4.1-mini',
    'temperature' => 0.1,
    'response_format' => ['type' => 'json_object'],
    'messages' => $modelInput['messages'],
];

$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ],
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 90,
]);

$result = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErrno = curl_errno($ch);
$curlError = curl_error($ch);
curl_close($ch);

if ($result === false) {
    $return['status'] = $curlErrno === CURLE_OPERATION_TIMEDOUT ? 504 : 500;
    warning('Fehler beim Aufruf der OpenAI-API: ' . $curlError);
    $agentFinalizeLog('openai_transport_error', [
        'http_status' => $return['status'],
        'curl_errno' => $curlErrno,
        'curl_error' => $curlError,
    ]);
    return;
}

if ($status < 200 || $status >= 300) {
    $return['status'] = $status;
    $errorText = '';
    $errorPayload = json_decode((string)$result, true);
    if (is_array($errorPayload) && !empty($errorPayload['error']['message'])) {
        $errorText = ' ' . $errorPayload['error']['message'];
    }
    if ($status == 429) {
        warning('OpenAI-Rate-Limit erreicht (429). Bitte kurz warten und erneut probieren.');
    } else {
        warning('Fehler bei der OpenAI-API (' . $status . ').' . $errorText);
    }
    $agentFinalizeLog('openai_http_error', [
        'http_status' => $status,
        'openai_response_raw' => $result,
    ]);
    return;
}

$decoded = json_decode($result, true);
if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
    $return['status'] = 500;
    warning('Antwort der OpenAI-API konnte nicht gelesen werden: ' . json_last_error_msg());
    $agentFinalizeLog('openai_invalid_json', [
        'http_status' => 500,
        'openai_response_raw' => $result,
        'json_error' => json_last_error_msg(),
    ]);
    return;
}

$raw = trim($decoded['choices'][0]['message']['content'] ?? '');
if ($raw === '') {
    $return['status'] = 500;
    warning('Leere Antwort der OpenAI-API erhalten.');
    $agentFinalizeLog('openai_empty_answer', [
        'http_status' => 500,
        'openai_response' => $decoded,
    ]);
    return;
}

if (strpos($raw, '```') === 0) {
    $raw = preg_replace('/^```[a-zA-Z]*\s*/', '', $raw);
    $raw = preg_replace('/```$/', '', $raw);
    $raw = trim($raw);
}

$parsed = json_decode($raw, true);
if ($parsed === null && json_last_error() !== JSON_ERROR_NONE) {
    $start = strpos($raw, '{');
    $end = strrpos($raw, '}');
    if ($start !== false && $end !== false && $end > $start) {
        $slice = substr($raw, $start, $end - $start + 1);
        $parsed = json_decode($slice, true);
    }
}

if ($parsed === null || !is_array($parsed)) {
    $return['status'] = 500;
    warning('Antwort der OpenAI-API ist kein gueltiges JSON.');
    $agentFinalizeLog('assistant_invalid_json', [
        'http_status' => 500,
        'assistant_raw' => $raw,
        'openai_response' => $decoded,
    ]);
    return;
}

$return['data'] = [
    'action' => (string)($parsed['action'] ?? ''),
    'html' => is_string($parsed['html'] ?? null) ? $parsed['html'] : '',
    'message' => is_string($parsed['message'] ?? null) ? $parsed['message'] : '',
    'block_level' => (bool)($parsed['block_level'] ?? false),
    'view' => ($parsed['view'] ?? '') === 'visual' ? 'visual' : 'html',
];

$agentFinalizeLog('success', [
    'http_status' => 200,
    'openai_http_status' => $status,
    'openai_response' => $decoded,
    'assistant_raw' => $raw,
    'assistant_parsed' => $return['data'],
]);

?>
