<?php

if (!isset($user['id'])) {
    $return['status'] = 401;
    warning('nicht eingeloggt');
    return;
}

if ($method !== 'POST') {
    $return['status'] = 405;
    warning('nur POST erlaubt');
    return;
}

$prompt = trim((string)($data['prompt'] ?? ''));
if ($prompt === '') {
    $return['status'] = 400;
    warning('prompt fehlt');
    return;
}

$apiKey = getenv('OPENAI_API_KEY') ?: (defined('OPENAI_API_KEY') ? OPENAI_API_KEY : '');
if (!$apiKey) {
    $return['status'] = 500;
    warning('Kein OpenAI API-Key im Backend gesetzt.');
    return;
}

$modelPolicyModule = dirname(__DIR__) . '/snippets/agent/model_policy.php';
if (is_readable($modelPolicyModule)) {
    include_once $modelPolicyModule;
}

$context = is_array($data['context'] ?? null) ? $data['context'] : [];
$historyPayload = is_array($data['history'] ?? null) ? $data['history'] : [];
$contextLabel = trim((string)($context['label'] ?? ''));
$contextName = trim((string)($context['context'] ?? ''));
$visibleItemsRaw = is_array($context['visible'] ?? null) ? $context['visible'] : [];
$visibleItems = [];
foreach ($visibleItemsRaw as $entry) {
    $line = trim((string)$entry);
    if ($line !== '') {
        $visibleItems[] = $line;
    }
    if (count($visibleItems) >= 16) {
        break;
    }
}

$normalizeHistoryText = function ($value, $maxChars = 700) {
    $text = trim((string)$value);
    if ($text === '' || $maxChars <= 0) {
        return '';
    }
    if (strlen($text) <= $maxChars) {
        return $text;
    }
    $remaining = strlen($text) - $maxChars;
    return substr($text, 0, $maxChars) . '...[truncated ' . $remaining . ' chars]';
};

$historySummary = $normalizeHistoryText($historyPayload['summary'] ?? '', 1400);
$historyTurnsRaw = is_array($historyPayload['turns'] ?? null) ? $historyPayload['turns'] : [];
$historyTurns = [];
foreach ($historyTurnsRaw as $entry) {
    if (!is_array($entry)) {
        continue;
    }
    $userText = $normalizeHistoryText($entry['user'] ?? ($entry['prompt'] ?? ''), 480);
    $assistantText = $normalizeHistoryText($entry['assistant'] ?? ($entry['response'] ?? ''), 620);
    if ($userText === '' || $assistantText === '') {
        continue;
    }
    $historyTurns[] = [
        'u' => $userText,
        'a' => $assistantText,
    ];
    if (count($historyTurns) >= 6) {
        break;
    }
}

$systemMessage =
    'Du klassifizierst Nutzeranfragen fuer eine Lernplattform als Intent-JSON. ' .
    'Antworte AUSSCHLIESSLICH als JSON mit Feldern: ' .
    'kind, confidence, topic, tab, view, reference. ' .
    'kind muss eines von diesen sein: ' .
    'navigate_tab, navigate_view, open_sheet_by_topic, list_sheets_by_topic, open_sheet_by_reference, ' .
    'audit_empty_sheets, audit_name_sheets, show_context, capability_search, show_sitemap, ' .
    'explain_data_model, suggest_data_fetch, analyze_exercises, analyze_assignment_completion, identify_struggling_learners, ' .
    'open_largest_class_by_learners, none. ' .
    'confidence ist 0 bis 1. ' .
    'Synonyme: "schueler" = "lernende"; "uebung"/"arbeitsblatt" = "sheet". ' .
    'Nutze open_sheet_by_reference fuer Nachfragen wie "diese oeffnen" oder "die erste". ' .
    'Nutze analyze_assignment_completion fuer Fragen, ob Lernende zugewiesene Blaetter eines Themas erledigt haben. ' .
    'Nutze open_largest_class_by_learners fuer Anfragen wie "oeffne die Klasse mit den meisten Schuelern". ' .
    'Nutze none wenn unklar. Keine Erklaertexte ausserhalb JSON.';

$userMessage = json_encode([
    'prompt' => $prompt,
    'context' => [
        'name' => $contextName,
        'label' => $contextLabel,
        'visible' => $visibleItems,
    ],
    'history' => [
        'summary' => $historySummary,
        'turns' => $historyTurns,
    ],
    'goal' => 'Intent fuer lokale Navigation/Suche bestimmen',
], JSON_UNESCAPED_UNICODE);

$messages = [
    [
        'role' => 'system',
        'content' => $systemMessage,
    ],
    [
        'role' => 'user',
        'content' => (string)$userMessage,
    ],
];

$modelCandidates = function_exists('agent_model_chain_for')
    ? agent_model_chain_for('intent')
    : ['gpt-4.1-mini'];

$parsed = null;
$selectedModel = '';
$finalStatus = 500;
$finalWarning = 'Agent-Intent konnte nicht bestimmt werden.';

foreach ($modelCandidates as $index => $modelName) {
    $requestBody = json_encode([
        'model' => $modelName,
        'messages' => $messages,
        'temperature' => 0,
        'response_format' => [
            'type' => 'json_object',
        ],
    ]);
    if (!is_string($requestBody) || $requestBody === '') {
        $finalStatus = 500;
        $finalWarning = 'OpenAI-Request konnte nicht serialisiert werden.';
        continue;
    }

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
        CURLOPT_POSTFIELDS => $requestBody,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 25,
    ]);

    $result = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErrno = curl_errno($ch);
    $curlError = curl_error($ch);
    curl_close($ch);

    $hasMoreCandidates = $index < count($modelCandidates) - 1;
    $shouldRetry = $hasMoreCandidates
        && (
            function_exists('agent_model_should_retry')
                ? agent_model_should_retry($status, (string)$result, $curlErrno)
                : ($curlErrno !== 0 || $status === 429 || $status >= 500)
        );

    if ($result === false) {
        $finalStatus = $curlErrno === CURLE_OPERATION_TIMEDOUT ? 504 : 500;
        $finalWarning = 'Fehler beim Aufruf der OpenAI-API: ' . $curlError;
        if ($shouldRetry) {
            continue;
        }
        break;
    }

    if ($status < 200 || $status >= 300) {
        $errorText = '';
        $errorPayload = json_decode((string)$result, true);
        if (is_array($errorPayload) && !empty($errorPayload['error']['message'])) {
            $errorText = ' ' . $errorPayload['error']['message'];
        }
        $finalStatus = $status;
        $finalWarning = 'Fehler bei der OpenAI-API (' . $status . ').' . $errorText;
        if ($shouldRetry) {
            continue;
        }
        break;
    }

    $decoded = json_decode((string)$result, true);
    if (!is_array($decoded)) {
        $finalStatus = 500;
        $finalWarning = 'Antwort der OpenAI-API konnte nicht gelesen werden.';
        if ($hasMoreCandidates) {
            continue;
        }
        break;
    }

    $raw = trim((string)($decoded['choices'][0]['message']['content'] ?? ''));
    if ($raw === '') {
        $finalStatus = 500;
        $finalWarning = 'Leere Antwort der OpenAI-API erhalten.';
        if ($hasMoreCandidates) {
            continue;
        }
        break;
    }

    if (strpos($raw, '```') === 0) {
        $raw = preg_replace('/^```[a-zA-Z]*\s*/', '', $raw);
        $raw = preg_replace('/```$/', '', $raw);
        $raw = trim((string)$raw);
    }

    $candidate = json_decode((string)$raw, true);
    if (!is_array($candidate)) {
        $start = strpos($raw, '{');
        $end = strrpos($raw, '}');
        if ($start !== false && $end !== false && $end > $start) {
            $slice = substr($raw, $start, $end - $start + 1);
            $candidate = json_decode((string)$slice, true);
        }
    }

    if (!is_array($candidate)) {
        $finalStatus = 500;
        $finalWarning = 'Antwort der OpenAI-API ist kein gueltiges JSON.';
        if ($hasMoreCandidates) {
            continue;
        }
        break;
    }

    $parsed = $candidate;
    $selectedModel = (string)$modelName;
    break;
}

if (!is_array($parsed)) {
    $return['status'] = $finalStatus;
    warning($finalWarning);
    return;
}

$normalizeKind = function ($value) {
    $kind = strtolower(trim((string)$value));
    $kind = preg_replace('/[^a-z0-9_]+/', '_', $kind);
    $kind = trim((string)$kind, '_');
    return $kind;
};

$allowedKinds = [
    'navigate_tab' => true,
    'navigate_view' => true,
    'open_sheet_by_topic' => true,
    'list_sheets_by_topic' => true,
    'open_sheet_by_reference' => true,
    'audit_empty_sheets' => true,
    'audit_name_sheets' => true,
    'show_context' => true,
    'capability_search' => true,
    'show_sitemap' => true,
    'explain_data_model' => true,
    'suggest_data_fetch' => true,
    'analyze_exercises' => true,
    'analyze_assignment_completion' => true,
    'identify_struggling_learners' => true,
    'open_largest_class_by_learners' => true,
    'none' => true,
];

$kind = $normalizeKind($parsed['kind'] ?? 'none');
if (!isset($allowedKinds[$kind])) {
    $kind = 'none';
}

$confidence = floatval($parsed['confidence'] ?? 0);
if (!is_finite($confidence)) {
    $confidence = 0;
}
$confidence = max(0, min(1, $confidence));

$tab = strtolower(trim((string)($parsed['tab'] ?? '')));
if (!in_array($tab, ['editor', 'classes', 'schools', 'settings'], true)) {
    $tab = '';
}

$view = strtolower(trim((string)($parsed['view'] ?? '')));
if (!in_array($view, ['html', 'visual', 'preview', 'answers'], true)) {
    $view = '';
}

$topic = trim((string)($parsed['topic'] ?? ''));
$reference = trim((string)($parsed['reference'] ?? ''));
if (strlen($topic) > 180) {
    $topic = substr($topic, 0, 180);
}
if (strlen($reference) > 120) {
    $reference = substr($reference, 0, 120);
}

$return['data'] = [
    'kind' => $kind,
    'confidence' => $confidence,
    'topic' => $topic,
    'tab' => $tab,
    'view' => $view,
    'reference' => $reference,
    'model' => $selectedModel,
];

?>
