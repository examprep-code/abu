<?php

if (!function_exists('ai_token_counter_column_exists')) {
    function ai_token_counter_column_exists($table, $column)
    {
        static $cache = [];
        $key = (string)$table . '.' . (string)$column;
        if (array_key_exists($key, $cache)) {
            return $cache[$key];
        }
        if (!function_exists('sql_get') || !function_exists('sql_escape')) {
            $cache[$key] = false;
            return false;
        }
        $rows = sql_get(
            'SHOW COLUMNS FROM `' . sql_escape((string)$table) . '` LIKE "' .
                sql_escape((string)$column) .
                '";'
        );
        $cache[$key] = !empty($rows);
        return $cache[$key];
    }
}

if (!function_exists('ai_token_counter_ensure_user_columns')) {
    function ai_token_counter_ensure_user_columns()
    {
        static $ensured = null;
        if ($ensured !== null) {
            return $ensured;
        }
        if (!function_exists('sql_set')) {
            $ensured = false;
            return false;
        }

        $columns = [
            'ai_request_count' => 'INT',
            'ai_prompt_tokens' => 'INT',
            'ai_completion_tokens' => 'INT',
            'ai_total_tokens' => 'INT',
            'ai_prompt_cost_usd' => 'FLOAT',
            'ai_completion_cost_usd' => 'FLOAT',
            'ai_total_cost_usd' => 'FLOAT',
        ];

        foreach ($columns as $column => $type) {
            if (ai_token_counter_column_exists('user', $column)) {
                continue;
            }
            $ok = sql_set('ALTER TABLE `user` ADD COLUMN `' . $column . '` ' . $type . ';');
            if ($ok === false) {
                $ensured = false;
                return false;
            }
        }

        $ensured = true;
        return true;
    }
}

if (!function_exists('ai_token_counter_normalize_stats')) {
    function ai_token_counter_normalize_stats($row)
    {
        $entry = is_array($row) ? $row : [];
        $promptTokens = max(0, intval($entry['ai_prompt_tokens'] ?? 0));
        $completionTokens = max(0, intval($entry['ai_completion_tokens'] ?? 0));
        $totalTokens = max(
            max(0, intval($entry['ai_total_tokens'] ?? 0)),
            $promptTokens + $completionTokens
        );
        $promptCost = max(0, floatval($entry['ai_prompt_cost_usd'] ?? 0));
        $completionCost = max(0, floatval($entry['ai_completion_cost_usd'] ?? 0));
        $totalCost = max(
            max(0, floatval($entry['ai_total_cost_usd'] ?? 0)),
            $promptCost + $completionCost
        );

        return [
            'requests' => max(0, intval($entry['ai_request_count'] ?? 0)),
            'prompt_tokens' => $promptTokens,
            'completion_tokens' => $completionTokens,
            'total_tokens' => $totalTokens,
            'prompt_cost_usd' => $promptCost,
            'completion_cost_usd' => $completionCost,
            'total_cost_usd' => $totalCost,
        ];
    }
}

if (!function_exists('ai_token_counter_get_user_stats')) {
    function ai_token_counter_get_user_stats($userId)
    {
        $id = intval($userId);
        if ($id <= 0 || !ai_token_counter_ensure_user_columns()) {
            return ai_token_counter_normalize_stats([]);
        }

        $rows = sql_get(
            'SELECT `ai_request_count`,`ai_prompt_tokens`,`ai_completion_tokens`,`ai_total_tokens`,' .
                '`ai_prompt_cost_usd`,`ai_completion_cost_usd`,`ai_total_cost_usd` ' .
                'FROM `user` WHERE `id` = ' . $id . ' LIMIT 1;'
        );
        return ai_token_counter_normalize_stats($rows[0] ?? []);
    }
}

if (!function_exists('ai_token_counter_usage_from_openai_response')) {
    function ai_token_counter_usage_from_openai_response($openaiResponse)
    {
        if (!is_array($openaiResponse)) {
            return [
                'prompt_tokens' => 0,
                'completion_tokens' => 0,
                'total_tokens' => 0,
                'cached_prompt_tokens' => 0,
                'has_usage' => false,
            ];
        }

        $usage = is_array($openaiResponse['usage'] ?? null) ? $openaiResponse['usage'] : [];
        $promptTokens = intval($usage['prompt_tokens'] ?? ($usage['input_tokens'] ?? 0));
        $completionTokens = intval($usage['completion_tokens'] ?? ($usage['output_tokens'] ?? 0));
        $totalTokens = intval($usage['total_tokens'] ?? 0);
        if ($totalTokens <= 0) {
            $totalTokens = max(0, $promptTokens) + max(0, $completionTokens);
        }

        $promptDetails = is_array($usage['prompt_tokens_details'] ?? null)
            ? $usage['prompt_tokens_details']
            : [];
        $cachedPromptTokens = intval($promptDetails['cached_tokens'] ?? 0);

        return [
            'prompt_tokens' => max(0, $promptTokens),
            'completion_tokens' => max(0, $completionTokens),
            'total_tokens' => max(0, $totalTokens),
            'cached_prompt_tokens' => max(0, $cachedPromptTokens),
            'has_usage' => !empty($usage),
        ];
    }
}

if (!function_exists('ai_token_counter_env_float')) {
    function ai_token_counter_env_float($name)
    {
        $value = getenv($name);
        if ($value === false || trim((string)$value) === '') {
            if (defined($name)) {
                $value = constant($name);
            } else {
                return null;
            }
        }
        if (!is_numeric($value)) {
            return null;
        }
        return max(0, floatval($value));
    }
}

if (!function_exists('ai_token_counter_model_pricing')) {
    function ai_token_counter_model_pricing($model)
    {
        // USD per 1M tokens. Override with AI_TOKEN_PRICING_JSON when prices change.
        $defaults = [
            'gpt-4.1' => ['prompt' => 2.00, 'cached_prompt' => 0.50, 'completion' => 8.00],
            'gpt-4.1-mini' => ['prompt' => 0.40, 'cached_prompt' => 0.10, 'completion' => 1.60],
            'gpt-4o-mini' => ['prompt' => 0.15, 'cached_prompt' => 0.075, 'completion' => 0.60],
        ];

        $json = getenv('AI_TOKEN_PRICING_JSON');
        if ($json !== false && trim((string)$json) !== '') {
            $decoded = json_decode((string)$json, true);
            if (is_array($decoded)) {
                foreach ($decoded as $key => $value) {
                    if (!is_array($value)) {
                        continue;
                    }
                    $defaults[(string)$key] = [
                        'prompt' => max(0, floatval($value['prompt'] ?? ($value['input'] ?? 0))),
                        'cached_prompt' => max(0, floatval($value['cached_prompt'] ?? ($value['cached_input'] ?? ($value['prompt'] ?? ($value['input'] ?? 0))))),
                        'completion' => max(0, floatval($value['completion'] ?? ($value['output'] ?? 0))),
                    ];
                }
            }
        }

        $modelKey = strtolower(trim((string)$model));
        $modelKey = preg_replace('/-\d{4}-\d{2}-\d{2}$/', '', $modelKey);
        if (isset($defaults[$modelKey])) {
            return $defaults[$modelKey];
        }

        $prompt = ai_token_counter_env_float('AI_TOKEN_PROMPT_COST_PER_1M');
        $completion = ai_token_counter_env_float('AI_TOKEN_COMPLETION_COST_PER_1M');
        if ($prompt !== null || $completion !== null) {
            return [
                'prompt' => $prompt ?? 0,
                'cached_prompt' => $prompt ?? 0,
                'completion' => $completion ?? 0,
            ];
        }

        return ['prompt' => 0, 'cached_prompt' => 0, 'completion' => 0];
    }
}

if (!function_exists('ai_token_counter_costs_from_usage')) {
    function ai_token_counter_costs_from_usage($usage, $model)
    {
        $entry = is_array($usage) ? $usage : [];
        $pricing = ai_token_counter_model_pricing($model);
        $promptTokens = max(0, intval($entry['prompt_tokens'] ?? 0));
        $cachedPromptTokens = min($promptTokens, max(0, intval($entry['cached_prompt_tokens'] ?? 0)));
        $uncachedPromptTokens = max(0, $promptTokens - $cachedPromptTokens);
        $completionTokens = max(0, intval($entry['completion_tokens'] ?? 0));

        $promptCost = (
            ($uncachedPromptTokens * floatval($pricing['prompt'] ?? 0)) +
            ($cachedPromptTokens * floatval($pricing['cached_prompt'] ?? ($pricing['prompt'] ?? 0)))
        ) / 1000000;
        $completionCost = ($completionTokens * floatval($pricing['completion'] ?? 0)) / 1000000;

        return [
            'prompt_cost_usd' => max(0, $promptCost),
            'completion_cost_usd' => max(0, $completionCost),
            'total_cost_usd' => max(0, $promptCost + $completionCost),
        ];
    }
}

if (!function_exists('ai_token_counter_format_float_sql')) {
    function ai_token_counter_format_float_sql($value)
    {
        return rtrim(rtrim(number_format(max(0, floatval($value)), 10, '.', ''), '0'), '.') ?: '0';
    }
}

if (!function_exists('ai_token_counter_record_usage')) {
    function ai_token_counter_record_usage($userId, $usage, $model = '')
    {
        $id = intval($userId);
        if ($id <= 0 || !ai_token_counter_ensure_user_columns()) {
            return null;
        }

        $entry = is_array($usage) ? $usage : [];
        $promptTokens = max(0, intval($entry['prompt_tokens'] ?? 0));
        $completionTokens = max(0, intval($entry['completion_tokens'] ?? 0));
        $totalTokens = max(max(0, intval($entry['total_tokens'] ?? 0)), $promptTokens + $completionTokens);
        $costs = ai_token_counter_costs_from_usage($entry, $model);

        $assignments = [
            '`ai_request_count` = COALESCE(`ai_request_count`, 0) + 1',
            '`ai_prompt_tokens` = COALESCE(`ai_prompt_tokens`, 0) + ' . $promptTokens,
            '`ai_completion_tokens` = COALESCE(`ai_completion_tokens`, 0) + ' . $completionTokens,
            '`ai_total_tokens` = COALESCE(`ai_total_tokens`, 0) + ' . $totalTokens,
            '`ai_prompt_cost_usd` = COALESCE(`ai_prompt_cost_usd`, 0) + ' . ai_token_counter_format_float_sql($costs['prompt_cost_usd'] ?? 0),
            '`ai_completion_cost_usd` = COALESCE(`ai_completion_cost_usd`, 0) + ' . ai_token_counter_format_float_sql($costs['completion_cost_usd'] ?? 0),
            '`ai_total_cost_usd` = COALESCE(`ai_total_cost_usd`, 0) + ' . ai_token_counter_format_float_sql($costs['total_cost_usd'] ?? 0),
        ];
        if (ai_token_counter_column_exists('user', 'updated_at')) {
            $assignments[] = '`updated_at` = "' . date('Y-m-d H:i:s') . '"';
        }

        $ok = sql_set(
            'UPDATE `user` SET ' . implode(', ', $assignments) .
                ' WHERE `id` = ' . $id . ' LIMIT 1;'
        );
        if ($ok === false) {
            return null;
        }

        return ai_token_counter_get_user_stats($id);
    }
}

if (!function_exists('ai_token_counter_record_openai_response')) {
    function ai_token_counter_record_openai_response($userId, $openaiResponse, $model = '')
    {
        if (!is_array($openaiResponse)) {
            return null;
        }
        $usage = ai_token_counter_usage_from_openai_response($openaiResponse);
        return ai_token_counter_record_usage($userId, $usage, $model);
    }
}

if (!function_exists('ai_token_counter_resolve_answer_user_id')) {
    function ai_token_counter_resolve_answer_user_id($payload)
    {
        global $user;
        $authenticatedUserId = intval($user['id'] ?? 0);
        if ($authenticatedUserId > 0) {
            return $authenticatedUserId;
        }

        if (!function_exists('sql_get') || !function_exists('sql_escape')) {
            return 0;
        }

        $entry = is_array($payload) ? $payload : [];
        $sheet = trim((string)($entry['sheet'] ?? ''));
        if ($sheet === '') {
            return 0;
        }

        $conditions = ['`key` = "' . sql_escape($sheet) . '"'];
        if (ctype_digit($sheet)) {
            $conditions[] = '`id` = ' . intval($sheet);
        }

        $rows = sql_get(
            'SELECT `user` FROM `sheet` WHERE (' . implode(' OR ', $conditions) .
                ') LIMIT 1;'
        );
        return max(0, intval($rows[0]['user'] ?? 0));
    }
}

?>
