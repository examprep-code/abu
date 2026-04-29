<?php

$agentLoggingModule = dirname(__DIR__) . '/snippets/agent/logging.php';
if (is_readable($agentLoggingModule)) {
    include_once $agentLoggingModule;
}
$modelPolicyModule = dirname(__DIR__) . '/snippets/agent/model_policy.php';
if (is_readable($modelPolicyModule)) {
    include_once $modelPolicyModule;
}
include_once dirname(__DIR__) . '/datian-core/agent_openai_json.php';

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
$historyPayload = is_array($data['history'] ?? null) ? $data['history'] : [];
$notesPath = dirname(__DIR__) . '/AGENT_README.md';

$normalizeHistoryText = function ($value, $maxChars = 1800) {
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

$normalizeHistoryPayload = function ($input) use ($normalizeHistoryText) {
    $payload = is_array($input) ? $input : [];
    $summary = $normalizeHistoryText($payload['summary'] ?? '', 2200);
    $turnsRaw = is_array($payload['turns'] ?? null) ? $payload['turns'] : [];
    $turns = [];
    foreach ($turnsRaw as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $user = $normalizeHistoryText($entry['user'] ?? ($entry['prompt'] ?? ''), 1100);
        $assistant = $normalizeHistoryText($entry['assistant'] ?? ($entry['response'] ?? ''), 1500);
        if ($user === '' || $assistant === '') {
            continue;
        }
        $turns[] = [
            'user' => $user,
            'assistant' => $assistant,
        ];
        if (count($turns) >= 8) {
            break;
        }
    }
    return [
        'summary' => $summary,
        'turns' => $turns,
    ];
};

$mergeHistoryMessages = function ($messages, $history) {
    $base = is_array($messages) ? $messages : [];
    $summary = trim((string)($history['summary'] ?? ''));
    $turns = is_array($history['turns'] ?? null) ? $history['turns'] : [];
    if (count($base) < 2 || ($summary === '' && empty($turns))) {
        return $base;
    }

    $systemMessage = $base[0];
    $currentUserMessage = $base[count($base) - 1];
    $merged = [$systemMessage];

    if ($summary !== '') {
        $merged[] = [
            'role' => 'system',
            'content' => "Kurzverlauf früherer Turns (kompakt):\n" . $summary,
        ];
    }

    foreach ($turns as $turn) {
        $user = trim((string)($turn['user'] ?? ''));
        $assistant = trim((string)($turn['assistant'] ?? ''));
        if ($user === '' || $assistant === '') {
            continue;
        }
        $merged[] = [
            'role' => 'user',
            'content' => $user,
        ];
        $merged[] = [
            'role' => 'assistant',
            'content' => $assistant,
        ];
    }

    $merged[] = $currentUserMessage;
    return $merged;
};

$history = $normalizeHistoryPayload($historyPayload);

$agentLogRecord['prompt'] = $prompt;
$agentLogRecord['prompt_schema'] = $promptSchema;
$agentLogRecord['context'] = $context;
$agentLogRecord['history'] = $history;

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

$modelMessages = $mergeHistoryMessages($modelInput['messages'] ?? [], $history);

$modelCandidates = function_exists('agent_model_chain_for')
    ? agent_model_chain_for('agent')
    : ['gpt-4.1-mini'];
$requestPayload = [
    'messages' => $modelMessages,
    'temperature' => 0.1,
    'response_format' => [
        'type' => 'json_object',
    ],
];

$agentLogRecord['request_schema'] = $modelInput['request_schema'] ?? [];
$agentLogRecord['normalized_prompt'] = (string)($modelInput['normalized_prompt'] ?? '');
$agentLogRecord['openai_request'] = [
    'model_candidates' => $modelCandidates,
    'temperature' => 0.1,
    'response_format' => ['type' => 'json_object'],
    'messages' => $modelMessages,
];

$openaiResult = function_exists('agent_openai_chat_json')
    ? agent_openai_chat_json($apiKey, $modelCandidates, $requestPayload)
    : ['ok' => false, 'error_kind' => 'missing_openai_helper'];

$selectedModel = (string)($openaiResult['selected_model'] ?? '');
$modelAttempts = is_array($openaiResult['attempts'] ?? null) ? $openaiResult['attempts'] : [];
$status = (int)($openaiResult['http_status'] ?? 0);
$decoded = is_array($openaiResult['openai_response'] ?? null) ? $openaiResult['openai_response'] : null;
$raw = (string)($openaiResult['assistant_raw'] ?? '');
$parsed = is_array($openaiResult['assistant_parsed'] ?? null) ? $openaiResult['assistant_parsed'] : null;

$agentLogRecord['openai_request']['selected_model'] = $selectedModel;
$agentLogRecord['openai_request']['attempts'] = $modelAttempts;

if (empty($openaiResult['ok'])) {
    $kind = (string)($openaiResult['error_kind'] ?? 'openai_error');
    $curlErrno = (int)($openaiResult['curl_errno'] ?? 0);
    $curlError = (string)($openaiResult['curl_error'] ?? '');
    $openaiRaw = (string)($openaiResult['openai_response_raw'] ?? '');

    if ($kind === 'openai_transport_error') {
        $return['status'] = $curlErrno === CURLE_OPERATION_TIMEDOUT ? 504 : 500;
        warning('Fehler beim Aufruf der OpenAI-API: ' . $curlError);
        $agentFinalizeLog('openai_transport_error', [
            'http_status' => $return['status'],
            'curl_errno' => $curlErrno,
            'curl_error' => $curlError,
            'openai_attempts' => $modelAttempts,
        ]);
        return;
    }

    if ($kind === 'openai_http_error') {
        $return['status'] = $status ?: 500;
        $errorText = '';
        $errorPayload = json_decode((string)$openaiRaw, true);
        if (is_array($errorPayload) && !empty($errorPayload['error']['message'])) {
            $errorText = ' ' . $errorPayload['error']['message'];
        }
        if ($return['status'] == 429) {
            warning('OpenAI-Rate-Limit erreicht (429). Bitte kurz warten und erneut probieren.');
        } else {
            warning('Fehler bei der OpenAI-API (' . $return['status'] . ').' . $errorText);
        }
        $agentFinalizeLog('openai_http_error', [
            'http_status' => $return['status'],
            'openai_response_raw' => $openaiRaw,
            'openai_attempts' => $modelAttempts,
        ]);
        return;
    }

    if ($kind === 'openai_invalid_json') {
        $return['status'] = 500;
        $jsonErrorText = (string)($openaiResult['json_error'] ?? '');
        warning('Antwort der OpenAI-API konnte nicht gelesen werden: ' . ($jsonErrorText !== '' ? $jsonErrorText : 'unknown'));
        $agentFinalizeLog('openai_invalid_json', [
            'http_status' => 500,
            'openai_response_raw' => $openaiRaw,
            'json_error' => $jsonErrorText,
            'openai_attempts' => $modelAttempts,
        ]);
        return;
    }

    if ($kind === 'openai_empty_answer') {
        $return['status'] = 500;
        warning('Leere Antwort der OpenAI-API erhalten.');
        $agentFinalizeLog('openai_empty_answer', [
            'http_status' => 500,
            'openai_response' => $decoded,
            'openai_attempts' => $modelAttempts,
        ]);
        return;
    }

    if ($kind === 'assistant_invalid_json') {
        $return['status'] = 500;
        $assistantRaw = (string)($openaiResult['assistant_raw'] ?? '');
        warning('Antwort der OpenAI-API ist kein gültiges JSON.');
        $agentFinalizeLog('assistant_invalid_json', [
            'http_status' => 500,
            'assistant_raw' => $assistantRaw,
            'openai_response' => $decoded,
            'openai_attempts' => $modelAttempts,
        ]);
        return;
    }

    $return['status'] = 500;
    warning('Fehler bei der OpenAI-API.');
    $agentFinalizeLog('openai_error', [
        'http_status' => 500,
        'error_kind' => $kind,
        'openai_response_raw' => $openaiRaw,
        'openai_attempts' => $modelAttempts,
    ]);
    return;
}

$return['data'] = [
    'action' => (string)($parsed['action'] ?? ''),
    'html' => is_string($parsed['html'] ?? null) ? $parsed['html'] : '',
    'message' => is_string($parsed['message'] ?? null) ? $parsed['message'] : '',
    'block_level' => (bool)($parsed['block_level'] ?? false),
    'view' => ($parsed['view'] ?? '') === 'visual' ? 'visual' : 'html',
    'model' => $selectedModel,
];

$agentFinalizeLog('success', [
    'http_status' => 200,
    'openai_http_status' => $status,
    'openai_model' => $selectedModel,
    'openai_attempts' => $modelAttempts,
    'openai_response' => $decoded,
    'assistant_raw' => $raw,
    'assistant_parsed' => $return['data'],
]);

?>
