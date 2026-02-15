<?php

if (!function_exists('agent_model_config_value')) {
    function agent_model_config_value($name, $default = '')
    {
        $env = getenv($name);
        if ($env !== false && trim((string)$env) !== '') {
            return trim((string)$env);
        }
        if (defined($name)) {
            $value = constant($name);
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }
        return $default;
    }
}

if (!function_exists('agent_model_parse_list')) {
    function agent_model_parse_list($value)
    {
        $result = [];
        if (!is_string($value) || trim($value) === '') {
            return $result;
        }
        $parts = preg_split('/[,;\s]+/', trim($value));
        foreach ($parts as $part) {
            $item = trim((string)$part);
            if ($item === '') {
                continue;
            }
            if (!in_array($item, $result, true)) {
                $result[] = $item;
            }
        }
        return $result;
    }
}

if (!function_exists('agent_model_chain_for')) {
    function agent_model_chain_for($purpose)
    {
        $key = strtolower(trim((string)$purpose));
        $spec = [
            'intent' => [
                'primary_key' => 'AGENT_INTENT_MODEL',
                'fallback_key' => 'AGENT_INTENT_FALLBACK_MODELS',
                'default_primary' => 'gpt-4o-mini',
                'default_fallback' => ['gpt-4.1-mini'],
            ],
            'agent' => [
                'primary_key' => 'AGENT_MAIN_MODEL',
                'fallback_key' => 'AGENT_MAIN_FALLBACK_MODELS',
                'default_primary' => 'gpt-4.1-mini',
                'default_fallback' => ['gpt-4o-mini'],
            ],
            'grading' => [
                'primary_key' => 'AGENT_GRADING_MODEL',
                'fallback_key' => 'AGENT_GRADING_FALLBACK_MODELS',
                'default_primary' => 'gpt-4.1-mini',
                'default_fallback' => ['gpt-4o-mini'],
            ],
        ];
        $entry = $spec[$key] ?? $spec['agent'];
        $primary = agent_model_config_value($entry['primary_key'], $entry['default_primary']);
        $fallbackRaw = agent_model_config_value($entry['fallback_key'], '');
        $fallback = agent_model_parse_list($fallbackRaw);
        if (empty($fallback)) {
            $fallback = $entry['default_fallback'];
        }

        $models = [];
        foreach (array_merge([$primary], $fallback) as $candidate) {
            $name = trim((string)$candidate);
            if ($name === '') {
                continue;
            }
            if (!in_array($name, $models, true)) {
                $models[] = $name;
            }
        }
        if (empty($models)) {
            $models = ['gpt-4.1-mini'];
        }
        return $models;
    }
}

if (!function_exists('agent_model_should_retry')) {
    function agent_model_should_retry($status, $responseBody = '', $curlErrno = 0)
    {
        $http = intval($status);
        if ($curlErrno !== 0) {
            return true;
        }
        if ($http === 429 || $http >= 500) {
            return true;
        }
        if ($http === 0) {
            return true;
        }
        if ($http === 400 || $http === 404) {
            $decoded = json_decode((string)$responseBody, true);
            $code = strtolower(trim((string)($decoded['error']['code'] ?? '')));
            $message = strtolower(trim((string)($decoded['error']['message'] ?? '')));
            if (strpos($code, 'model') !== false) {
                return true;
            }
            if (strpos($message, 'model') !== false && strpos($message, 'not found') !== false) {
                return true;
            }
        }
        return false;
    }
}

?>
