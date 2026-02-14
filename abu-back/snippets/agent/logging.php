<?php

if (!function_exists('agent_env_string')) {
    function agent_env_string($name, $default = '')
    {
        $value = getenv($name);
        if (($value === false || trim((string)$value) === '') && defined($name)) {
            $value = constant($name);
        }
        if ($value === false) {
            return $default;
        }
        $value = trim((string)$value);
        return $value === '' ? $default : $value;
    }
}

if (!function_exists('agent_env_int')) {
    function agent_env_int($name, $default = 0)
    {
        $value = getenv($name);
        if (($value === false || trim((string)$value) === '') && defined($name)) {
            $value = constant($name);
        }
        if ($value === false || trim((string)$value) === '') {
            return $default;
        }
        $parsed = intval($value);
        return $parsed > 0 ? $parsed : $default;
    }
}

if (!function_exists('agent_env_bool')) {
    function agent_env_bool($name, $default = false)
    {
        $value = getenv($name);
        if (($value === false || trim((string)$value) === '') && defined($name)) {
            $value = constant($name);
        }
        if ($value === false || trim((string)$value) === '') {
            return $default;
        }
        $normalized = strtolower(trim((string)$value));
        if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) {
            return true;
        }
        if (in_array($normalized, ['0', 'false', 'no', 'off'], true)) {
            return false;
        }
        return $default;
    }
}

if (!function_exists('agent_logger_config')) {
    function agent_logger_config()
    {
        $baseDir = agent_env_string('AGENT_LOG_DIR', dirname(__DIR__, 2) . '/storage/agent-logs');
        return [
            'enabled' => agent_env_bool('AGENT_LOG_ENABLED', true),
            'base_dir' => $baseDir,
            'redact' => agent_env_bool('AGENT_LOG_REDACT', true),
            'max_depth' => agent_env_int('AGENT_LOG_MAX_DEPTH', 10),
            'max_items' => agent_env_int('AGENT_LOG_MAX_ITEMS', 250),
            'max_string' => agent_env_int('AGENT_LOG_MAX_STRING', 18000),
        ];
    }
}

if (!function_exists('agent_mask_sensitive_text')) {
    function agent_mask_sensitive_text($value)
    {
        $text = (string)$value;
        $text = preg_replace('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', '[redacted-email]', $text);
        $text = preg_replace_callback('/\+?\d[\d\-\s()]{7,}\d/', function ($match) {
            $candidate = (string)($match[0] ?? '');
            $digits = preg_replace('/\D+/', '', $candidate);
            if (strlen((string)$digits) < 9) {
                return $candidate;
            }
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $candidate)) {
                return $candidate;
            }
            return '[redacted-phone]';
        }, $text);
        $text = preg_replace('/sk-[A-Za-z0-9]{20,}/', '[redacted-openai-key]', $text);
        $text = preg_replace('/Bearer\s+[A-Za-z0-9\-\._]+/i', 'Bearer [redacted-token]', $text);
        return $text;
    }
}

if (!function_exists('agent_truncate_text')) {
    function agent_truncate_text($value, $maxLength)
    {
        $text = (string)$value;
        $length = strlen($text);
        if ($length <= $maxLength) {
            return $text;
        }
        $remaining = $length - $maxLength;
        return substr($text, 0, $maxLength) . '...[truncated ' . $remaining . ' chars]';
    }
}

if (!function_exists('agent_sanitize_for_log')) {
    function agent_sanitize_for_log($value, $config, $depth = 0)
    {
        if ($depth >= (int)$config['max_depth']) {
            return '[max-depth]';
        }

        if ($value === null || is_bool($value) || is_int($value) || is_float($value)) {
            return $value;
        }

        if (is_string($value)) {
            $text = $config['redact'] ? agent_mask_sensitive_text($value) : $value;
            return agent_truncate_text($text, (int)$config['max_string']);
        }

        if (is_array($value)) {
            $maxItems = (int)$config['max_items'];
            $result = [];
            $count = 0;
            foreach ($value as $key => $entry) {
                if ($count >= $maxItems) {
                    $result['__truncated_items'] = count($value) - $maxItems;
                    break;
                }
                $result[$key] = agent_sanitize_for_log($entry, $config, $depth + 1);
                $count++;
            }
            return $result;
        }

        if (is_object($value)) {
            return [
                '__class' => get_class($value),
            ];
        }

        return '[' . gettype($value) . ']';
    }
}

if (!function_exists('agent_log_json_encode')) {
    function agent_log_json_encode($value)
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}

if (!function_exists('agent_log_make_id')) {
    function agent_log_make_id()
    {
        if (function_exists('random_bytes')) {
            try {
                return bin2hex(random_bytes(10));
            } catch (Throwable $ignore) {
            }
        }
        return str_replace('.', '', uniqid('', true));
    }
}

if (!function_exists('agent_log_append_record')) {
    function agent_log_append_record($record, $config = null)
    {
        $settings = is_array($config) ? $config : agent_logger_config();
        if (empty($settings['enabled'])) {
            return null;
        }

        $baseDir = rtrim((string)$settings['base_dir'], '/');
        if ($baseDir === '') {
            return null;
        }
        if (!is_dir($baseDir) && !mkdir($baseDir, 0775, true) && !is_dir($baseDir)) {
            return null;
        }

        $logId = agent_log_make_id();
        $payload = is_array($record) ? $record : ['value' => $record];
        $payload['log_id'] = $logId;
        $payload['logged_at_utc'] = gmdate('c');
        $payload = agent_sanitize_for_log($payload, $settings, 0);

        $targetFile = $baseDir . '/events-' . gmdate('Y-m-d') . '.jsonl';
        $line = agent_log_json_encode($payload);
        if (!is_string($line) || $line === '') {
            return null;
        }
        $ok = @file_put_contents($targetFile, $line . "\n", FILE_APPEND | LOCK_EX);
        if ($ok === false) {
            return null;
        }
        return $logId;
    }
}

?>
