<?php

/**
 * Shared OpenAI Chat Completions helper (JSON object output).
 *
 * This is intentionally generic so other routes can reuse the same retry + parsing
 * behavior without coupling to a specific agent response schema.
 */

if (!function_exists('agent_openai_chat_json')) {
    function agent_openai_chat_json($apiKey, $modelCandidates, $requestPayload, $options = [])
    {
        $apiKey = (string)$apiKey;
        $models = is_array($modelCandidates) ? $modelCandidates : [];
        $payload = is_array($requestPayload) ? $requestPayload : [];
        $endpoint = is_string($options['endpoint'] ?? null) ? (string)$options['endpoint'] : 'https://api.openai.com/v1/chat/completions';
        $connectTimeout = isset($options['connect_timeout']) ? intval($options['connect_timeout']) : 10;
        $timeout = isset($options['timeout']) ? intval($options['timeout']) : 90;

        $status = 0;
        $curlErrno = 0;
        $curlError = '';
        $selectedModel = '';
        $attempts = [];
        $decoded = null;
        $rawResponse = '';
        $assistantRaw = '';
        $assistantParsed = null;
        $jsonErrorMessage = '';

        foreach ($models as $index => $modelName) {
            $modelName = trim((string)$modelName);
            if ($modelName === '') {
                continue;
            }

            $body = json_encode(array_merge($payload, ['model' => $modelName]));
            if (!is_string($body) || $body === '') {
                return [
                    'ok' => false,
                    'error_kind' => 'request_serialization_failed',
                    'http_status' => 500,
                    'curl_errno' => 0,
                    'curl_error' => 'OpenAI-Request konnte nicht serialisiert werden.',
                    'selected_model' => '',
                    'attempts' => $attempts,
                    'openai_response_raw' => '',
                    'openai_response' => null,
                    'assistant_raw' => '',
                    'assistant_parsed' => null,
                    'json_error' => '',
                ];
            }

            $ch = curl_init($endpoint);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $apiKey,
                ],
                CURLOPT_POSTFIELDS => $body,
                CURLOPT_CONNECTTIMEOUT => $connectTimeout,
                CURLOPT_TIMEOUT => $timeout,
            ]);

            $tryResult = curl_exec($ch);
            $tryStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $tryCurlErrno = curl_errno($ch);
            $tryCurlError = curl_error($ch);
            curl_close($ch);

            $attempts[] = [
                'model' => (string)$modelName,
                'http_status' => (int)$tryStatus,
                'curl_errno' => (int)$tryCurlErrno,
                'curl_error' => (string)$tryCurlError,
            ];

            $status = (int)$tryStatus;
            $curlErrno = (int)$tryCurlErrno;
            $curlError = (string)$tryCurlError;
            $rawResponse = $tryResult === false ? '' : (string)$tryResult;

            $hasMoreCandidates = $index < count($models) - 1;
            $shouldRetry = $hasMoreCandidates
                && (
                    function_exists('agent_model_should_retry')
                        ? agent_model_should_retry($tryStatus, (string)$rawResponse, $tryCurlErrno)
                        : ($tryCurlErrno !== 0 || $tryStatus === 429 || $tryStatus >= 500)
                );

            if ($tryResult === false || $tryStatus < 200 || $tryStatus >= 300) {
                if ($shouldRetry) {
                    continue;
                }

                return [
                    'ok' => false,
                    'error_kind' => $tryResult === false ? 'openai_transport_error' : 'openai_http_error',
                    'http_status' => (int)$tryStatus,
                    'curl_errno' => (int)$tryCurlErrno,
                    'curl_error' => (string)$tryCurlError,
                    'selected_model' => '',
                    'attempts' => $attempts,
                    'openai_response_raw' => (string)$rawResponse,
                    'openai_response' => null,
                    'assistant_raw' => '',
                    'assistant_parsed' => null,
                    'json_error' => '',
                ];
            }

            $tryDecoded = json_decode((string)$rawResponse, true);
            if ($tryDecoded === null && json_last_error() !== JSON_ERROR_NONE) {
                $jsonErrorMessage = json_last_error_msg();
                if ($hasMoreCandidates) {
                    continue;
                }
                return [
                    'ok' => false,
                    'error_kind' => 'openai_invalid_json',
                    'http_status' => 500,
                    'curl_errno' => 0,
                    'curl_error' => '',
                    'selected_model' => '',
                    'attempts' => $attempts,
                    'openai_response_raw' => (string)$rawResponse,
                    'openai_response' => null,
                    'assistant_raw' => '',
                    'assistant_parsed' => null,
                    'json_error' => (string)$jsonErrorMessage,
                ];
            }

            $tryAssistantRaw = trim((string)($tryDecoded['choices'][0]['message']['content'] ?? ''));
            if ($tryAssistantRaw === '') {
                if ($hasMoreCandidates) {
                    continue;
                }
                return [
                    'ok' => false,
                    'error_kind' => 'openai_empty_answer',
                    'http_status' => 500,
                    'curl_errno' => 0,
                    'curl_error' => '',
                    'selected_model' => '',
                    'attempts' => $attempts,
                    'openai_response_raw' => (string)$rawResponse,
                    'openai_response' => $tryDecoded,
                    'assistant_raw' => '',
                    'assistant_parsed' => null,
                    'json_error' => '',
                ];
            }

            if (strpos($tryAssistantRaw, '```') === 0) {
                $tryAssistantRaw = preg_replace('/^```[a-zA-Z]*\s*/', '', $tryAssistantRaw);
                $tryAssistantRaw = preg_replace('/```$/', '', $tryAssistantRaw);
                $tryAssistantRaw = trim((string)$tryAssistantRaw);
            }

            $tryParsed = json_decode((string)$tryAssistantRaw, true);
            if ($tryParsed === null && json_last_error() !== JSON_ERROR_NONE) {
                $start = strpos($tryAssistantRaw, '{');
                $end = strrpos($tryAssistantRaw, '}');
                if ($start !== false && $end !== false && $end > $start) {
                    $slice = substr($tryAssistantRaw, $start, $end - $start + 1);
                    $tryParsed = json_decode((string)$slice, true);
                }
            }

            if ($tryParsed === null || !is_array($tryParsed)) {
                if ($hasMoreCandidates) {
                    continue;
                }
                return [
                    'ok' => false,
                    'error_kind' => 'assistant_invalid_json',
                    'http_status' => 500,
                    'curl_errno' => 0,
                    'curl_error' => '',
                    'selected_model' => (string)$modelName,
                    'attempts' => $attempts,
                    'openai_response_raw' => (string)$rawResponse,
                    'openai_response' => $tryDecoded,
                    'assistant_raw' => (string)$tryAssistantRaw,
                    'assistant_parsed' => null,
                    'json_error' => '',
                ];
            }

            $selectedModel = (string)$modelName;
            $decoded = $tryDecoded;
            $assistantRaw = (string)$tryAssistantRaw;
            $assistantParsed = $tryParsed;
            break;
        }

        if ($selectedModel === '' || $assistantParsed === null) {
            return [
                'ok' => false,
                'error_kind' => 'openai_no_successful_candidate',
                'http_status' => $status ?: 500,
                'curl_errno' => $curlErrno,
                'curl_error' => $curlError,
                'selected_model' => $selectedModel,
                'attempts' => $attempts,
                'openai_response_raw' => (string)$rawResponse,
                'openai_response' => $decoded,
                'assistant_raw' => (string)$assistantRaw,
                'assistant_parsed' => $assistantParsed,
                'json_error' => (string)$jsonErrorMessage,
            ];
        }

        return [
            'ok' => true,
            'error_kind' => '',
            'http_status' => (int)$status,
            'curl_errno' => 0,
            'curl_error' => '',
            'selected_model' => (string)$selectedModel,
            'attempts' => $attempts,
            'openai_response_raw' => (string)$rawResponse,
            'openai_response' => $decoded,
            'assistant_raw' => $assistantRaw,
            'assistant_parsed' => $assistantParsed,
            'json_error' => '',
        ];
    }
}

?>

