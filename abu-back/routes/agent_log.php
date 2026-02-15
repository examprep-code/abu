<?php

$agentLoggingModule = dirname(__DIR__) . '/snippets/agent/logging.php';
if (is_readable($agentLoggingModule)) {
    include_once $agentLoggingModule;
}

if (!isset($user['id'])) {
    $return['status'] = 401;
    warning('nicht eingeloggt');
    return;
}

$userId = intval($user['id'] ?? 0);
if ($userId <= 0) {
    $return['status'] = 401;
    warning('ungueltiger user');
    return;
}

$ensureAgentChatLogTable = function () {
    static $ensured = false;
    if ($ensured) {
        return true;
    }

    $sql = 'CREATE TABLE IF NOT EXISTS `agent_chat_log` ('
        . '`id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,'
        . '`user` INT NOT NULL,'
        . '`prompt` LONGTEXT,'
        . '`agent_flow` LONGTEXT,'
        . '`response` LONGTEXT,'
        . '`status` VARCHAR(255),'
        . '`context` LONGTEXT,'
        . '`source` VARCHAR(255),'
        . '`action` VARCHAR(255),'
        . '`outcome` VARCHAR(120),'
        . '`is_error` INT(1),'
        . '`model_intent` LONGTEXT,'
        . '`navigation` LONGTEXT,'
        . '`agent_result` LONGTEXT,'
        . '`rating` INT,'
        . '`rating_comment` LONGTEXT,'
        . '`rated_at` DATETIME,'
        . '`created_at` DATETIME,'
        . '`updated_at` DATETIME,'
        . 'INDEX `idx_agent_chat_log_user` (`user`),'
        . 'INDEX `idx_agent_chat_log_created_at` (`created_at`)'
        . ') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;';

    $ok = sql_set($sql);
    $ensured = $ok !== false;
    return $ensured;
};

$truncateText = function ($value, $maxBytes = 250000) {
    $text = (string)($value ?? '');
    if ($maxBytes <= 0) {
        return '';
    }
    if (strlen($text) <= $maxBytes) {
        return $text;
    }
    $remaining = strlen($text) - $maxBytes;
    return substr($text, 0, $maxBytes) . '...[truncated ' . $remaining . ' bytes]';
};

$encodeJson = function ($value, $fallback = '{}') {
    $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (is_string($json)) {
        return $json;
    }
    return $fallback;
};

$sqlValue = function ($value, $nullable = false) {
    if ($value === null && $nullable) {
        return 'null';
    }
    $text = (string)$value;
    if ($nullable && trim($text) === '') {
        return 'null';
    }
    return '"' . sql_escape($text) . '"';
};

$normalizeRating = function ($value) {
    if (is_bool($value)) {
        return $value ? 1 : -1;
    }

    if (is_int($value) || is_float($value) || (is_string($value) && is_numeric($value))) {
        $numeric = intval($value);
        if ($numeric > 0) {
            return 1;
        }
        if ($numeric === 0) {
            return 0;
        }
        if ($numeric < 0) {
            return -1;
        }
    }

    $normalized = strtolower(trim((string)$value));
    if (in_array($normalized, ['positive', 'positiv', 'up', 'like', 'thumbs_up', 'good', 'ok', '+'], true)) {
        return 1;
    }
    if (in_array($normalized, ['partial', 'partly', 'teilweise', 'teils', 'middle', 'neutral', 'mid', '~'], true)) {
        return 0;
    }
    if (in_array($normalized, ['negative', 'negativ', 'down', 'dislike', 'thumbs_down', 'bad', '-'], true)) {
        return -1;
    }

    return null;
};

if (!$ensureAgentChatLogTable()) {
    $return['status'] = 500;
    warning('agent_chat_log table konnte nicht erstellt werden');
    return;
}

if ($method === 'POST') {
    $prompt = trim((string)($data['prompt'] ?? ''));
    if ($prompt === '') {
        $return['status'] = 400;
        warning('prompt fehlt');
        return;
    }

    $response = trim((string)($data['response'] ?? ($data['output'] ?? '')));
    $statusText = trim((string)($data['status'] ?? ''));
    $source = strtolower(trim((string)($data['source'] ?? 'ui')));
    if ($source === '') {
        $source = 'ui';
    }

    $error = !empty($data['error']);
    $outcome = strtolower(trim((string)($data['outcome'] ?? '')));
    if ($outcome === '') {
        $outcome = $error ? 'client_error' : 'client_success';
    }
    if (strlen($outcome) > 120) {
        $outcome = substr($outcome, 0, 120);
    }

    $context = is_array($data['context'] ?? null) ? $data['context'] : [];
    $modelIntent = is_array($data['model_intent'] ?? null) ? $data['model_intent'] : null;
    $navigation = is_array($data['navigation'] ?? null) ? $data['navigation'] : null;
    $action = trim((string)($data['action'] ?? ''));
    $agentResult = is_array($data['agent_result'] ?? null) ? $data['agent_result'] : null;

    $agentFlowInput = $data['agent_flow'] ?? null;
    $agentFlow = null;
    if (is_array($agentFlowInput)) {
        $agentFlow = $agentFlowInput;
    } elseif (is_string($agentFlowInput) && trim($agentFlowInput) !== '') {
        $decodedFlow = json_decode($agentFlowInput, true);
        if (is_array($decodedFlow)) {
            $agentFlow = $decodedFlow;
        }
    }

    if (!is_array($agentFlow)) {
        $agentFlow = [
            'source' => $source,
            'error' => $error,
            'steps' => [],
        ];
        if (is_array($modelIntent)) {
            $agentFlow['steps'][] = [
                'type' => 'model_intent',
                'data' => $modelIntent,
            ];
        }
        if (is_array($navigation)) {
            $agentFlow['steps'][] = [
                'type' => 'navigation',
                'data' => $navigation,
            ];
        }
        if ($action !== '') {
            $agentFlow['steps'][] = [
                'type' => 'action',
                'data' => $action,
            ];
        }
        if (is_array($agentResult)) {
            $agentFlow['steps'][] = [
                'type' => 'agent_result',
                'data' => $agentResult,
            ];
        }
    }

    $now = date('Y-m-d H:i:s');

    $promptText = $truncateText($prompt);
    $responseText = $truncateText($response);
    $statusValue = $truncateText($statusText, 255);
    $sourceValue = $truncateText($source, 255);
    $actionValue = $truncateText($action, 255);
    $contextJson = $truncateText($encodeJson($context, '{}'));
    $modelIntentJson = $modelIntent !== null ? $truncateText($encodeJson($modelIntent, '{}')) : '';
    $navigationJson = $navigation !== null ? $truncateText($encodeJson($navigation, '{}')) : '';
    $agentResultJson = $agentResult !== null ? $truncateText($encodeJson($agentResult, '{}')) : '';
    $agentFlowJson = $truncateText($encodeJson($agentFlow, '{}'));

    $sql = 'INSERT INTO `agent_chat_log` ('
        . '`user`,`prompt`,`agent_flow`,`response`,`status`,`context`,`source`,`action`,`outcome`,`is_error`,'
        . '`model_intent`,`navigation`,`agent_result`,`created_at`,`updated_at`'
        . ') VALUES ('
        . $userId . ','
        . $sqlValue($promptText) . ','
        . $sqlValue($agentFlowJson) . ','
        . $sqlValue($responseText) . ','
        . $sqlValue($statusValue, true) . ','
        . $sqlValue($contextJson, true) . ','
        . $sqlValue($sourceValue, true) . ','
        . $sqlValue($actionValue, true) . ','
        . $sqlValue($outcome, true) . ','
        . intval($error ? 1 : 0) . ','
        . $sqlValue($modelIntentJson, true) . ','
        . $sqlValue($navigationJson, true) . ','
        . $sqlValue($agentResultJson, true) . ','
        . $sqlValue($now) . ','
        . $sqlValue($now)
        . ');';

    $insertId = intval(sql_set($sql, true));
    if ($insertId <= 0) {
        $return['status'] = 500;
        warning('agent log konnte nicht gespeichert werden');
        return;
    }

    if (function_exists('agent_log_append_record')) {
        $agentLogConfig = function_exists('agent_logger_config')
            ? agent_logger_config()
            : ['enabled' => false];
        agent_log_append_record([
            'event' => 'agent_chat',
            'route' => 'agent_log',
            'request_method' => 'POST',
            'user' => ['id' => $userId],
            'db_log_id' => $insertId,
            'prompt' => $prompt,
            'context' => $context,
            'agent_flow' => $agentFlow,
            'assistant_raw' => $response,
            'assistant_parsed' => [
                'message' => $response,
                'status' => $statusText,
                'source' => $source,
                'action' => $action,
                'error' => $error,
            ],
            'model_intent' => $modelIntent,
            'navigation' => $navigation,
            'agent_result' => $agentResult,
            'outcome' => $outcome,
            'http_status' => 200,
            'started_at_utc' => gmdate('c'),
            'finished_at_utc' => gmdate('c'),
            'duration_ms' => 0,
        ], $agentLogConfig);
    }

    $return['data'] = [
        'logged' => true,
        'log_id' => (string)$insertId,
    ];
    $return['log']['agent_log_id'] = (string)$insertId;
    return;
}

if ($method === 'PATCH') {
    $logId = intval($data['log_id'] ?? ($data['id'] ?? 0));
    if ($logId <= 0) {
        $return['status'] = 400;
        warning('log_id fehlt');
        return;
    }

    $rating = $normalizeRating($data['rating'] ?? null);
    if ($rating === null) {
        $return['status'] = 400;
        warning('rating fehlt oder ungueltig');
        return;
    }

    $commentRaw = trim((string)($data['comment'] ?? ($data['rating_comment'] ?? '')));
    $comment = $truncateText($commentRaw, 12000);

    $existing = sql_get(
        'SELECT `id` FROM `agent_chat_log` WHERE `id` = ' . $logId . ' AND `user` = ' . $userId . ' LIMIT 1;'
    );
    if (empty($existing)) {
        $return['status'] = 404;
        warning('agent log nicht gefunden');
        return;
    }

    $now = date('Y-m-d H:i:s');
    $sql = 'UPDATE `agent_chat_log` SET '
        . '`rating` = ' . $rating . ', '
        . '`rating_comment` = ' . $sqlValue($comment, true) . ', '
        . '`rated_at` = ' . $sqlValue($now) . ', '
        . '`updated_at` = ' . $sqlValue($now)
        . ' WHERE `id` = ' . $logId . ' AND `user` = ' . $userId . ' LIMIT 1;';
    $ok = sql_set($sql);
    if ($ok === false) {
        $return['status'] = 500;
        warning('bewertung konnte nicht gespeichert werden');
        return;
    }

    $return['data'] = [
        'rated' => true,
        'log_id' => (string)$logId,
        'rating' => $rating,
        'comment' => $comment,
    ];
    return;
}

$return['status'] = 405;
warning('nur POST oder PATCH erlaubt');

?>
