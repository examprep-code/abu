<?php

$answerConfig = [
    'answer' => answer_payload_fields(),
];
$learnerSession = get_learner_session();
$modelPolicyModule = dirname(__DIR__) . '/snippets/agent/model_policy.php';
if (is_readable($modelPolicyModule)) {
    include_once $modelPolicyModule;
}

// POST: speichern und KI-Bewertung zurückgeben
if ($method === 'POST') {
    if (!is_array($data)) {
        $data = [];
    }
    $saveOnly = !empty($data['save_only']) || !empty($data['saveOnly']);
    $chatgpt = $saveOnly ? [] : bewerteAntwortMitKI($data);
    $submittedUser = trim((string)($data['user'] ?? ''));
    $isPreviewMode = is_preview_answer_request($data, $submittedUser);
    $isAnonymousRuntimeUser = strpos($submittedUser, 'anon_') === 0;

    if (!$isAnonymousRuntimeUser && !empty($learnerSession['code'])) {
        $data['user'] = $learnerSession['code'];
    } elseif (empty($data['user'])) {
        $data['user'] = 'testnutzer';
    }

    if (answer_table_has_column('classroom')) {
        if (!$isAnonymousRuntimeUser && !empty($learnerSession['classroom'])) {
            $classroomId = intval($learnerSession['classroom']);
        } elseif (array_key_exists('classroom', $data)) {
            $classroomId = intval($data['classroom']);
        } else {
            $classroomId = 0;
        }

        if ($classroomId > 0) {
            $data['classroom'] = $classroomId;
        } else {
            unset($data['classroom']);
        }
    } else {
        unset($data['classroom']);
    }

    // Speichere die KI-Klassifizierung direkt mit der Antwort. Save-only wird für
    // Freitext-Referenz-Snapshots genutzt und darf keine bestehende Bewertung verlieren.
    if (answer_table_has_column('classification')) {
        if (!$saveOnly && isset($chatgpt['classification'])) {
            $data['classification'] = $chatgpt['classification']; // numeric 0/500/1000
        } elseif ($saveOnly) {
            $mapped = mapClassificationScore($data['classification'] ?? null);
            if ($mapped === null) {
                $mapped = latest_answer_classification(
                    $data['sheet'] ?? '',
                    $data['key'] ?? '',
                    $data['user'] ?? '',
                    $data['classroom'] ?? null
                );
            }
            if ($mapped !== null) {
                $data['classification'] = $mapped;
            } else {
                unset($data['classification']);
            }
        } else {
            unset($data['classification']);
        }
    } else {
        unset($data['classification']);
    }

    if (!$saveOnly) {
        enrich_answer_value_with_source_context($data, $chatgpt);
    }

    // Timestamps setzen
    $now = date('Y-m-d H:i:s');
    $data['created_at'] = $now;
    $data['updated_at'] = $now;

    if ($isPreviewMode) {
        $return['data'] = ['id' => upsert_preview_answer($data)];
    } else {
        serve($answerConfig, ['POST']);
    }

    if ($saveOnly) {
        return;
    }

    // Stelle sicher, dass die KI-Rückmeldung im Response bleibt
    $return['data']['chatgpt'] = $chatgpt;

    if (!empty($chatgpt['error'])) {
        $return['warning'] = $chatgpt['error'];
    }

    // Logging der Anfrage und KI-Antwort
    include_once 'model/log.php';
    $logEntry = [
        'request' => json_encode($data, JSON_UNESCAPED_UNICODE),
        'chatgpt' => json_encode($return['data']['chatgpt'] ?? [], JSON_UNESCAPED_UNICODE),
        'created_at' => $now,
        'updated_at' => $now,
    ];
    sql_create('log', $logEntry);

    return;
}

// PUT/PATCH: Klassifizierung manuell anpassen
if ($method === 'PUT' || $method === 'PATCH') {
    if (!answer_table_has_column('classification')) {
        $return['status'] = 400;
        $return['warning'] = 'classification ist in dieser Datenbank nicht verfügbar';
        return;
    }
    $userId = intval($user['id'] ?? 0);
    if ($userId <= 0) {
        $return['status'] = 401;
        $return['warning'] = 'nicht eingeloggt';
        return;
    }

    $id = $data['id'] ?? null;
    if (empty($id)) {
        $return['status'] = 400;
        $return['warning'] = 'id fehlt';
        return;
    }

    $mapped = mapClassificationScore($data['classification'] ?? null);
    if ($mapped === null) {
        $return['status'] = 400;
        $return['warning'] = 'classification ungültig';
        return;
    }

    $data['classification'] = $mapped;
    $data['updated_at'] = date('Y-m-d H:i:s');

    $scopeWhere = answer_scope_clause_for_user($userId);
    $existing = sql_get(
        'SELECT `id` FROM `answer` WHERE `id` = ' . intval($id) . ' AND ' . $scopeWhere . ' LIMIT 1;'
    );
    if (empty($existing)) {
        $return['status'] = 404;
        $return['warning'] = 'answer nicht gefunden';
        return;
    }

    sql_update('answer', [
        'classification' => $data['classification'],
        'updated_at' => $data['updated_at'],
    ], intval($id));
    return;
}

// Optional Filter via URL-Parametern:
// /answer//{sheet}
// /answer//{sheet}/{user}
// oder als Query: /answer?sheet={sheet}[&user={user}]
if ($method === 'GET') {
    $where = [];
    $userId = intval($user['id'] ?? 0);

    $sheet = $paras[0] ?? ($_GET['sheet'] ?? null);
    $answerUser = $paras[1] ?? ($_GET['user'] ?? null);
    $classroom = $_GET['classroom'] ?? null;

    if (empty($answerUser) && !empty($learnerSession['code'])) {
        $answerUser = $learnerSession['code'];
    }
    if (empty($classroom) && !empty($learnerSession['classroom'])) {
        $classroom = $learnerSession['classroom'];
    }

    if (!empty($sheet)) {
        $where[] = '`sheet` = "' . sql_escape($sheet) . '"';
    }
    if (!empty($answerUser)) {
        $where[] = '`user` = "' . sql_escape($answerUser) . '"';
    }
    if (!empty($classroom) && answer_table_has_column('classroom')) {
        $where[] = '`classroom` = ' . intval($classroom);
    }

    if ($userId > 0) {
        $where[] = answer_scope_clause_for_user($userId);
    } elseif (!empty($learnerSession['code'])) {
        // Learner sees only own entries, resolved above via answerUser.
    } elseif (empty($sheet)) {
        $return['status'] = 400;
        $return['warning'] = 'sheet fehlt';
        return;
    }

    $answerConfig['answer']['_where'] = $where;
    $return['data'] = array_merge($return['data'], get($answerConfig));
    return;
}

serve($answerConfig);

function bewerteAntwortMitKI($payload)
{
    $apiKey = getenv('OPENAI_API_KEY') ?: (defined('OPENAI_API_KEY') ? OPENAI_API_KEY : '');
    if (!$apiKey) {
        return ['error' => 'Kein OpenAI API-Key im Backend gesetzt.'];
    }

    $sourceContext = build_gap_source_context($payload);
    if (!empty($sourceContext)) {
        $payload['_source_context'] = $sourceContext;
        $payload['_source_context_text'] = source_context_text($sourceContext);
    }
    if (strtolower(trim((string)($payload['exercise_type'] ?? ''))) === 'freitext') {
        $payload = enrich_freitext_payload_with_context_prompts($payload);
    }

    $messages = build_answer_feedback_messages($payload);
    if (empty($messages)) {
        return ['error' => 'Feedback-Prompt konnte nicht erzeugt werden.'];
    }
    $promptSources = build_answer_prompt_sources($payload, $messages);

    $modelCandidates = function_exists('agent_model_chain_for')
        ? agent_model_chain_for('grading')
        : ['gpt-4.1-mini'];
    $selectedModel = '';
    $decoded = null;
    $result = '';
    $finalError = 'Fehler bei der OpenAI-API.';

    foreach ($modelCandidates as $index => $modelName) {
        $requestBody = [
            'model' => $modelName,
            'messages' => $messages,
            'temperature' => 0,
        ];
        $body = json_encode($requestBody);
        if (!is_string($body) || $body === '') {
            $finalError = 'OpenAI-Request konnte nicht serialisiert werden.';
            continue;
        }

        answer_ai_console_log('OpenAI Anfrage', [
            'attempt' => $index + 1,
            'sheet' => (string)($payload['sheet'] ?? ''),
            'key' => (string)($payload['key'] ?? ''),
            'exercise_type' => (string)($payload['exercise_type'] ?? 'luecke'),
            'request' => $requestBody,
            'prompt_sources' => $promptSources,
        ]);

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
            ],
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_TIMEOUT => 20,
        ]);

        $tryResult = curl_exec($ch);
        $tryStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $tryCurlErrno = curl_errno($ch);
        $tryCurlError = curl_error($ch);
        curl_close($ch);

        answer_ai_console_log('OpenAI Antwort', [
            'attempt' => $index + 1,
            'sheet' => (string)($payload['sheet'] ?? ''),
            'key' => (string)($payload['key'] ?? ''),
            'exercise_type' => (string)($payload['exercise_type'] ?? 'luecke'),
            'model' => (string)$modelName,
            'http_status' => $tryStatus,
            'curl_errno' => $tryCurlErrno,
            'curl_error' => $tryCurlError,
            'response' => answer_ai_decode_json_for_log($tryResult),
        ]);

        $hasMoreCandidates = $index < count($modelCandidates) - 1;
        $shouldRetry = $hasMoreCandidates
            && (
                function_exists('agent_model_should_retry')
                    ? agent_model_should_retry($tryStatus, (string)$tryResult, $tryCurlErrno)
                    : ($tryCurlErrno !== 0 || $tryStatus === 429 || $tryStatus >= 500)
            );

        if ($tryResult === false) {
            $finalError = 'Fehler beim Aufruf der OpenAI-API: ' . $tryCurlError;
            if ($shouldRetry) {
                continue;
            }
            return ['error' => $finalError];
        }

        if ($tryStatus < 200 || $tryStatus >= 300) {
            if ($tryStatus == 429) {
                $finalError = 'OpenAI-Rate-Limit erreicht (429). Bitte kurz warten und erneut probieren.';
            } else {
                $finalError = 'Fehler bei der OpenAI-API (' . $tryStatus . ').';
            }
            if ($shouldRetry) {
                continue;
            }
            return ['error' => $finalError];
        }

        $decodedCandidate = json_decode($tryResult, true);
        if ($decodedCandidate === null && json_last_error() !== JSON_ERROR_NONE) {
            $finalError = 'Antwort der OpenAI-API konnte nicht gelesen werden: ' . json_last_error_msg();
            if ($hasMoreCandidates) {
                continue;
            }
            return ['error' => $finalError];
        }

        if (!isset($decodedCandidate['choices'][0]['message']['content'])) {
            $errText = '';
            if (!empty($decodedCandidate['error']['message'])) {
                $errText = $decodedCandidate['error']['message'];
            } elseif (!empty($tryResult)) {
                $errText = 'Leere Antwort erhalten. Rohdaten: ' . substr($tryResult, 0, 2000);
            } else {
                $errText = 'Leere Antwort erhalten.';
            }
            $finalError = $errText;
            if ($hasMoreCandidates) {
                continue;
            }
            return ['error' => $finalError];
        }

        $decoded = $decodedCandidate;
        $result = (string)$tryResult;
        $selectedModel = (string)$modelName;
        break;
    }

    if (!is_array($decoded)) {
        return ['error' => $finalError];
    }

    $inhalt = $decoded['choices'][0]['message']['content'] ?? '';
    $rohText = trim($inhalt ?: 'Keine Rückmeldung erhalten.');

    $lines = preg_split('/\r\n|\r|\n/', $rohText);
    $ersteZeile = strtoupper(trim($lines[0] ?? ''));
    $classificationLabel = null;
    $classificationScore = null;
    $erklärung = $rohText;

    if (in_array($ersteZeile, ['RICHTIG', 'TEILWEISE', 'FALSCH'])) {
        $classificationLabel = $ersteZeile;
        $erklärung = trim(implode("\n", array_slice($lines, 1)));
    }

    // Mapping der Klassifizierung auf Skala 0–1000
    if ($classificationLabel === 'RICHTIG') {
        $classificationScore = 1000;
    } elseif ($classificationLabel === 'TEILWEISE') {
        $classificationScore = 500;
    } elseif ($classificationLabel === 'FALSCH') {
        $classificationScore = 0;
    }

    $extractedData = extract_data_json_from_feedback($erklärung);
    if (!empty($extractedData['found'])) {
        $erklärung = $extractedData['clean_explanation'];
    }

    $result = [
        'classification' => $classificationScore,
        'classification_label' => $classificationLabel,
        'explanation' => $erklärung,
        'raw' => $rohText,
        'model' => $selectedModel,
    ];
    if (!empty($sourceContext)) {
        if (!empty($extractedData['data'])) {
            $sourceContext['facts'] = array_merge(
                is_array($sourceContext['facts'] ?? null) ? $sourceContext['facts'] : [],
                $extractedData['data']
            );
        }
        $sourceContext = annotate_source_context_quality($sourceContext);
        $result['source_context'] = $sourceContext;
        $result = apply_property_portal_feedback($result, $sourceContext);
    }
    answer_ai_console_log('KI Bewertung', [
        'sheet' => (string)($payload['sheet'] ?? ''),
        'key' => (string)($payload['key'] ?? ''),
        'exercise_type' => (string)($payload['exercise_type'] ?? 'luecke'),
        'result' => $result,
    ]);
    return $result;
}

function apply_property_portal_feedback($result, $sourceContext)
{
    if (!is_array($result) || !is_array($sourceContext)) {
        return $result;
    }
    if (empty($sourceContext['known_property_portal']) && empty($sourceContext['direct_listing_url'])) {
        return $result;
    }

    $facts = is_array($sourceContext['facts'] ?? null) ? $sourceContext['facts'] : [];
    if (source_context_extracted_listing_fact_count($facts) > 0) {
        return $result;
    }

    $portal = trim((string)($facts['portal'] ?? 'Die Immobilienplattform'));
    $listingId = trim((string)($facts['listing_id'] ?? ''));
    $idText = $listingId !== '' ? ' mit der Inseratenummer ' . $listingId : '';
    $linkText = !empty($sourceContext['direct_listing_url'])
        ? 'der Domain und der direkten Inserats-URL'
        : 'der Domain eines bekannten Immobilienportals';
    $blockedText = source_context_has_antibot_signal($sourceContext)
        ? $portal . ' nutzt offenbar Anti-Bot/CAPTCHA-Schutz; deshalb konnte die Seite nicht vollständig automatisch geladen werden.'
        : 'Die Seite konnte nicht vollständig automatisch gelesen werden.';
    $result['explanation'] = $blockedText .
        ' Aufgrund ' . $linkText .
        $idText .
        ' ist es aber vermutlich ein Wohnungs- bzw. Immobilieninserat.';

    $score = mapClassificationScore($result['classification'] ?? null);
    if ($score === null || $score < 500) {
        $result['classification'] = 500;
        $result['classification_label'] = 'TEILWEISE';
    }
    return $result;
}

function source_context_has_antibot_signal($sourceContext)
{
    if (!is_array($sourceContext)) {
        return false;
    }
    $text = strtolower(
        implode(' ', [
            (string)($sourceContext['source_status'] ?? ''),
            (string)($sourceContext['source_status_detail'] ?? ''),
            (string)($sourceContext['fallback_reason'] ?? ''),
            (string)($sourceContext['error'] ?? ''),
            (string)($sourceContext['excerpt'] ?? ''),
        ])
    );
    return preg_match('/captcha|anti-bot|antibot|datadome|enable js|please enable js|access denied|forbidden|403/u', $text) === 1;
}

function answer_ai_console_log($label, $payload)
{
    $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded) || $encoded === '') {
        $encoded = json_encode([
            'error' => 'Logdaten konnten nicht serialisiert werden.',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    error_log('[ABU KI] ' . $label . ': ' . $encoded);
}

function answer_ai_decode_json_for_log($raw)
{
    if (!is_string($raw) || $raw === '') {
        return $raw;
    }

    $decoded = json_decode($raw, true);
    if ($decoded !== null || json_last_error() === JSON_ERROR_NONE) {
        return $decoded;
    }

    return $raw;
}

function enrich_answer_value_with_source_context(&$data, $chatgpt)
{
    if (empty($chatgpt['source_context']) || !is_array($chatgpt['source_context'])) {
        return;
    }

    $raw = trim((string)($data['value'] ?? ''));
    if ($raw === '') {
        return;
    }

    $decoded = json_decode($raw, true);
    if (is_array($decoded) && (array_key_exists('answer', $decoded) || array_key_exists('text', $decoded))) {
        $decoded['type'] = $decoded['type'] ?? 'luecke';
        $decoded['version'] = max(2, intval($decoded['version'] ?? 0));
        $decoded['source_context'] = $chatgpt['source_context'];
        $encoded = json_encode($decoded, JSON_UNESCAPED_UNICODE);
        if (is_string($encoded) && $encoded !== '') {
            $data['value'] = $encoded;
        }
        return;
    }

    $encoded = json_encode([
        'type' => 'luecke',
        'version' => 2,
        'answer' => $raw,
        'source_context' => $chatgpt['source_context'],
    ], JSON_UNESCAPED_UNICODE);
    if (is_string($encoded) && $encoded !== '') {
        $data['value'] = $encoded;
    }
}

function build_gap_source_context($payload)
{
    $exerciseType = strtolower(trim((string)($payload['exercise_type'] ?? '')));
    if ($exerciseType === 'freitext') {
        return [];
    }

    $answer = trim((string)($payload['value'] ?? ''));
    $url = first_url_in_text($answer);
    if ($url === '') {
        return [];
    }

    $context = [
        'url' => $url,
        'source_status' => 'unavailable',
        'facts' => [],
    ];

    $previous = latest_source_context_for_answer($payload, $answer);
    $listingUrlHint = property_listing_context_from_url($url);
    $fetched = fetch_url_for_context($url);
    if (!empty($fetched['text'])) {
        $text = $fetched['text'];
        $facts = extract_listing_facts_from_text($text);
        $blocked = is_blocked_context_text($text);
        $context['source_status'] = ($blocked && empty($facts)) ? 'blocked' : 'read';
        if (!empty($fetched['http_status'])) {
            $context['http_status'] = $fetched['http_status'];
        }
        if (!empty($fetched['source_url']) && $fetched['source_url'] !== $url) {
            $context['read_via'] = $fetched['source_url'];
        }
        $context['facts'] = $facts;
        $context['excerpt'] = limit_context_text($text, 2500);
        $summary = listing_summary_from_facts($facts);
        if ($summary !== '') {
            $context['summary'] = $summary;
        }
    } elseif (!empty($fetched['error'])) {
        $context['source_status'] = 'error';
        $context['error'] = $fetched['error'];
    }

    if (!empty($previous)) {
        $context = merge_source_context($previous, $context);
    }
    if (!empty($listingUrlHint)) {
        $context = merge_listing_url_hint($context, $listingUrlHint);
    }

    return annotate_source_context_quality($context);
}

function first_url_in_text($text)
{
    if (preg_match('/https?:\/\/[^\s<>"\']+/i', (string)$text, $matches)) {
        return rtrim($matches[0], ".,;)");
    }
    return '';
}

function fetch_url_for_context($url)
{
    $attempts = [$url];
    if (preg_match('/^https?:\/\//i', $url)) {
        $attempts[] = 'https://r.jina.ai/' . $url;
    }

    $lastError = '';
    foreach ($attempts as $attemptUrl) {
        $result = curl_fetch_text($attemptUrl);
        if (!empty($result['error'])) {
            $lastError = $result['error'];
            continue;
        }
        $text = trim((string)($result['text'] ?? ''));
        if ($text === '') {
            continue;
        }

        $status = intval($result['http_status'] ?? 0);
        if ($status >= 400 && !preg_match('/zimmer|wohnfl|m²|m2|quadratmeter|wohnung|inserat/iu', $text)) {
            $lastError = 'HTTP ' . $status;
            continue;
        }

        return [
            'text' => html_to_context_text($text),
            'http_status' => $status,
            'source_url' => $attemptUrl,
        ];
    }

    return ['text' => '', 'error' => $lastError];
}

function property_listing_context_from_url($url)
{
    $parts = parse_url((string)$url);
    if (!is_array($parts) || empty($parts['host'])) {
        return [];
    }

    $host = strtolower((string)$parts['host']);
    $path = (string)($parts['path'] ?? '');
    $query = (string)($parts['query'] ?? '');
    $portal = known_property_portal_for_host($host);
    if (empty($portal)) {
        return [];
    }

    $directMatch = property_portal_direct_listing_match($path, $query, $portal);
    if (empty($directMatch) && !empty($portal['requires_path_hint'])) {
        return [];
    }

    $portalName = (string)$portal['name'];
    $listingId = trim((string)($directMatch['listing_id'] ?? ''));
    $operation = strtolower(trim((string)($directMatch['operation'] ?? '')));
    $listingKind = in_array($operation, ['buy', 'kaufen', 'acheter', 'comprare'], true)
        ? 'Kaufinserat'
        : (in_array($operation, ['rent', 'mieten', 'louer', 'affittare'], true) ? 'Mietinserat' : 'Immobilieninserat');
    $facts = [
        'portal' => $portalName,
        'portal_domain' => (string)$portal['domain'],
        'listing_kind' => $listingKind,
        'object_type' => 'Immobilieninserat',
    ];
    if ($listingId !== '') {
        $facts['listing_id'] = $listingId;
    }

    $isDirectListing = !empty($directMatch);
    $idText = $listingId !== '' ? ', Inseratenummer ' . $listingId : '';
    $summary = $isDirectListing
        ? 'Direkter ' . $portalName . '-' . $listingKind . '-Link' . $idText . '.'
        : 'Link zu einer bekannten Immobilienplattform (' . $portalName . ').';

    return [
        'source_status' => $isDirectListing ? 'known_listing_url' : 'known_listing_portal',
        'source_status_detail' => $isDirectListing
            ? 'Die URL passt zu einem direkten Inserat auf einer bekannten Immobilienplattform. Falls die Seite serverseitig durch CAPTCHA/Anti-Bot blockiert wird, ist das kein Hinweis gegen den direkten Link.'
            : 'Die Domain gehört zu einer bekannten Immobilienplattform. Falls die Seite serverseitig durch CAPTCHA/Anti-Bot blockiert wird, kann die konkrete Inseratsseite trotzdem nicht vollständig geprüft werden.',
        'known_property_portal' => true,
        'direct_listing_url' => $isDirectListing,
        'listing_confidence' => $isDirectListing ? 'url_pattern' : 'known_portal_domain',
        'facts' => $facts,
        'summary' => $summary,
    ];
}

function known_property_portal_for_host($host)
{
    $normalizedHost = preg_replace('/^www\./i', '', strtolower(trim((string)$host)));
    if ($normalizedHost === '') {
        return [];
    }

    $portals = [
        [
            'name' => 'Homegate',
            'domain' => 'homegate.ch',
            'hosts' => ['homegate.ch'],
            'direct_patterns' => ['~^/(mieten|kaufen)/(\d+)(?:/)?$~i'],
        ],
        [
            'name' => 'ImmoScout24',
            'domain' => 'immoscout24.ch',
            'hosts' => ['immoscout24.ch'],
            'direct_patterns' => ['~/(?:de|fr|it|en)/d/[^/?#]+~i', '~/(mieten|kaufen|rent|buy)/[^?#]*\d~i'],
        ],
        [
            'name' => 'Flatfox',
            'domain' => 'flatfox.ch',
            'hosts' => ['flatfox.ch'],
            'direct_patterns' => ['~/(?:de|fr|it|en)/(?:wohnung|immobilien|flat|rent|listing)[^?#]*\d~i', '~/listing/[^?#]+~i'],
        ],
        [
            'name' => 'Newhome',
            'domain' => 'newhome.ch',
            'hosts' => ['newhome.ch'],
            'direct_patterns' => ['~/(?:de|fr|it|en)/(?:mieten|kaufen|rent|buy)/[^?#]+~i'],
        ],
        [
            'name' => 'Comparis Immobilien',
            'domain' => 'comparis.ch',
            'hosts' => ['comparis.ch'],
            'requires_path_hint' => true,
            'direct_patterns' => ['~/immobilien/(?:marktplatz/)?details/[^?#]+~i', '~/immobilier/(?:marche/)?details/[^?#]+~i'],
        ],
        [
            'name' => 'ImmoStreet',
            'domain' => 'immostreet.ch',
            'hosts' => ['immostreet.ch'],
            'direct_patterns' => ['~/(?:de|fr|it|en)/(?:mieten|kaufen|immobilien|immobilier)/[^?#]+~i'],
        ],
        [
            'name' => 'Immobilier.ch',
            'domain' => 'immobilier.ch',
            'hosts' => ['immobilier.ch'],
            'direct_patterns' => ['~/(?:fr|de|it|en)/(?:louer|acheter|mieten|kaufen)/[^?#]+~i'],
        ],
        [
            'name' => 'Properstar',
            'domain' => 'properstar.ch',
            'hosts' => ['properstar.ch'],
            'direct_patterns' => ['~/(?:de|fr|it|en)/(?:immobilien|mieten|kaufen|rent|buy|property)/[^?#]+~i'],
        ],
        [
            'name' => 'Tutti Immobilien',
            'domain' => 'tutti.ch',
            'hosts' => ['tutti.ch'],
            'requires_path_hint' => true,
            'direct_patterns' => ['~/(?:immobilien|immobilier|case|real-estate|wohnung|mieten|kaufen)/[^?#]+~i'],
        ],
        [
            'name' => 'Anibis Immobilien',
            'domain' => 'anibis.ch',
            'hosts' => ['anibis.ch'],
            'requires_path_hint' => true,
            'direct_patterns' => ['~/(?:immobilien|immobilier|case|real-estate|wohnung|mieten|kaufen)/[^?#]+~i'],
        ],
    ];

    foreach ($portals as $portal) {
        foreach ($portal['hosts'] as $portalHost) {
            if (
                $normalizedHost === $portalHost ||
                substr($normalizedHost, -strlen('.' . $portalHost)) === '.' . $portalHost
            ) {
                return $portal;
            }
        }
    }
    return [];
}

function property_portal_direct_listing_match($path, $query, $portal)
{
    $value = (string)$path;
    if ($query !== '') {
        $value .= '?' . (string)$query;
    }

    foreach (($portal['direct_patterns'] ?? []) as $pattern) {
        if (preg_match($pattern, $value, $matches)) {
            $operation = '';
            foreach ($matches as $match) {
                $candidate = strtolower((string)$match);
                if (in_array($candidate, ['mieten', 'kaufen', 'rent', 'buy', 'louer', 'acheter', 'affittare', 'comprare'], true)) {
                    $operation = $candidate;
                    break;
                }
            }
            if ($operation === '') {
                if (preg_match('/\b(mieten|rent|louer|affittare)\b/i', $value, $operationMatches)) {
                    $operation = strtolower($operationMatches[1]);
                } elseif (preg_match('/\b(kaufen|buy|acheter|comprare)\b/i', $value, $operationMatches)) {
                    $operation = strtolower($operationMatches[1]);
                }
            }
            $listingId = '';
            if (preg_match('/\b(\d{5,})\b/', $value, $idMatches)) {
                $listingId = $idMatches[1];
            }
            return [
                'operation' => $operation,
                'listing_id' => $listingId,
            ];
        }
    }

    return [];
}

function merge_listing_url_hint($context, $hint)
{
    if (!is_array($context)) $context = [];
    if (!is_array($hint) || empty($hint)) return $context;

    $contextFacts = is_array($context['facts'] ?? null) ? $context['facts'] : [];
    $hintFacts = is_array($hint['facts'] ?? null) ? $hint['facts'] : [];
    $context['facts'] = array_merge($hintFacts, $contextFacts);

    foreach (['direct_listing_url', 'listing_confidence'] as $key) {
        if (!array_key_exists($key, $context) && array_key_exists($key, $hint)) {
            $context[$key] = $hint[$key];
        }
    }

    if (empty($context['summary']) && !empty($hint['summary'])) {
        $context['summary'] = $hint['summary'];
    }

    $status = strtolower(trim((string)($context['source_status'] ?? '')));
    $hasExtractedListingFacts = source_context_extracted_listing_fact_count($context['facts']) > 0;
    if (!$hasExtractedListingFacts || in_array($status, ['blocked', 'error', 'unavailable'], true)) {
        $context['source_status'] = $hint['source_status'] ?? 'known_listing_url';
        $context['source_status_detail'] = $hint['source_status_detail'] ?? '';
    } elseif (empty($context['source_status_detail']) && !empty($hint['source_status_detail'])) {
        $context['source_status_detail'] = $hint['source_status_detail'];
    }

    return $context;
}

function curl_fetch_text($url)
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_ENCODING => '',
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
            'Accept-Language: de-CH,de;q=0.9,en;q=0.6',
        ],
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    ]);
    $text = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $errno = curl_errno($ch);
    $error = curl_error($ch);
    curl_close($ch);

    if ($text === false || $errno !== 0) {
        return [
            'text' => '',
            'http_status' => $status,
            'error' => $error !== '' ? $error : 'URL konnte nicht gelesen werden.',
        ];
    }

    return [
        'text' => (string)$text,
        'http_status' => $status,
        'error' => '',
    ];
}

function html_to_context_text($text)
{
    $raw = (string)$text;
    $raw = preg_replace('/<script\b[^>]*>.*?<\/script>/is', ' ', $raw);
    $raw = preg_replace('/<style\b[^>]*>.*?<\/style>/is', ' ', $raw);
    $raw = preg_replace('/<noscript\b[^>]*>.*?<\/noscript>/is', ' ', $raw);
    $raw = strip_tags($raw);
    $raw = html_entity_decode($raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $raw = preg_replace('/[ \t]+/u', ' ', $raw);
    $raw = preg_replace('/\R{2,}/u', "\n", $raw);
    return limit_context_text(trim($raw), 14000);
}

function is_blocked_context_text($text)
{
    $lower = strtolower((string)$text);
    $needles = [
        'please enable js',
        'datadome',
        'captcha',
        'just a moment',
        'access denied',
        'are you a robot',
        'enable cookies',
        'unusual traffic',
    ];
    foreach ($needles as $needle) {
        if (strpos($lower, $needle) !== false) {
            return true;
        }
    }
    return false;
}

function extract_listing_facts_from_text($text)
{
    $plain = preg_replace('/\s+/u', ' ', (string)$text);
    $facts = [];

    if (preg_match('/(\d+(?:[.,]\d+)?)\s*(?:zimmer|zi\.?|rooms?)\b/iu', $plain, $matches)) {
        $facts['rooms'] = normalize_decimal_text($matches[1]);
    }

    if (
        preg_match('/(?:wohnfl(?:ae|ä)che|wohnfläche|nutzfläche|nutzfläche|living\s*area|fläche|fläche)[^\d]{0,40}(\d+(?:[.,]\d+)?)\s*(?:m²|m2|m\^2|qm|quadratmeter)\b/iu', $plain, $matches) ||
        preg_match('/(\d+(?:[.,]\d+)?)\s*(?:m²|m2|m\^2|qm|quadratmeter)\b/iu', $plain, $matches)
    ) {
        $facts['living_area_m2'] = normalize_decimal_text($matches[1]);
    }

    if (preg_match('/(?:CHF|Fr\.?)\s*([0-9][0-9\'’\s.]*)/u', $plain, $matches)) {
        $rent = preg_replace('/[^\d]/', '', $matches[1]);
        if ($rent !== '') {
            $facts['rent_chf'] = $rent;
        }
    }

    if (preg_match('/(?:adresse|address|ort|location)[^\w\d]{0,20}([A-ZÄÖÜ][^|]{3,120})/u', $plain, $matches)) {
        $facts['address'] = trim($matches[1]);
    }

    $title = first_context_title($text);
    if ($title !== '') {
        $facts['title'] = $title;
    }

    return $facts;
}

function normalize_decimal_text($value)
{
    return str_replace(',', '.', trim((string)$value));
}

function first_context_title($text)
{
    $lines = preg_split('/\R/u', (string)$text);
    foreach ($lines as $line) {
        $line = trim(preg_replace('/\s+/u', ' ', $line));
        if ($line === '' || strlen($line) > 180) {
            continue;
        }
        if (preg_match('/^(url source|warning|markdown content):/i', $line)) {
            continue;
        }
        if (preg_match('/please enable|captcha|datadome|just a moment/i', $line)) {
            continue;
        }
        if (preg_match('/wohnung|zimmer|mieten|haus|inserat|appartement|apartment/i', $line)) {
            return $line;
        }
    }
    return '';
}

function listing_summary_from_facts($facts)
{
    if (!is_array($facts) || empty($facts)) {
        return '';
    }
    $parts = [];
    if (!empty($facts['title'])) $parts[] = $facts['title'];
    if (!empty($facts['rooms'])) $parts[] = $facts['rooms'] . ' Zimmer';
    if (!empty($facts['living_area_m2'])) $parts[] = $facts['living_area_m2'] . ' m2 Wohnfläche';
    if (!empty($facts['rent_chf'])) $parts[] = 'CHF ' . $facts['rent_chf'];
    return implode(', ', $parts);
}

function annotate_source_context_quality($context)
{
    if (!is_array($context)) {
        return [];
    }

    $facts = is_array($context['facts'] ?? null) ? $context['facts'] : [];
    $status = strtolower(trim((string)($context['source_status'] ?? '')));
    $extractedFactCount = source_context_extracted_listing_fact_count($facts);
    $hasCoreFacts = !empty($facts['rooms']) && !empty($facts['living_area_m2']);
    $hasUsefulFacts = $hasCoreFacts || $extractedFactCount >= 3;
    $hasKnownListingUrl =
        !empty($context['direct_listing_url']) ||
        !empty($context['known_property_portal']) ||
        $status === 'known_listing_url' ||
        $status === 'known_listing_portal';
    $isBlocked = in_array($status, ['blocked', 'error', 'unavailable'], true);

    if ($hasUsefulFacts) {
        $quality = 'ok';
        $reason = 'Die wichtigsten Inseratsdaten konnten ausreichend gespeichert werden.';
    } elseif ($hasKnownListingUrl) {
        $quality = 'partial';
        $reason = 'Der direkte Inseratslink wurde anhand der Plattform-URL erkannt; Detaildaten konnten nicht automatisch gelesen werden.';
    } elseif ($extractedFactCount > 0) {
        $quality = 'partial';
        $reason = 'Nur ein Teil der Inseratsdaten konnte automatisch gelesen werden.';
    } elseif ($isBlocked) {
        $quality = 'insufficient';
        $reason = 'Die Inseratsseite konnte nicht ausreichend automatisch gelesen werden.';
    } else {
        $quality = 'insufficient';
        $reason = 'Es wurden keine verwertbaren Inseratsdaten extrahiert.';
    }

    $context['extraction_quality'] = $quality;
    $context['extraction_satisfactory'] = $quality === 'ok';
    $context['allow_flexible_followup'] = $quality !== 'ok';
    $context['fallback_reason'] = $reason;
    return $context;
}

function source_context_extracted_listing_fact_count($facts)
{
    if (!is_array($facts)) {
        return 0;
    }

    $extractableKeys = [
        'title',
        'address',
        'rooms',
        'living_area_m2',
        'rent_chf',
        'floor',
        'year_built',
        'features',
    ];
    $count = 0;
    foreach ($extractableKeys as $key) {
        if (array_key_exists($key, $facts) && trim(source_context_scalar($facts[$key])) !== '') {
            $count++;
        }
    }
    return $count;
}

function latest_source_context_for_answer($payload, $answer)
{
    if (!answer_table_has_column('value')) {
        return [];
    }

    $sheet = trim((string)($payload['sheet'] ?? ''));
    $key = trim((string)($payload['key'] ?? ''));
    $answerUser = trim((string)($payload['user'] ?? ''));
    if ($sheet === '' || $key === '' || $answerUser === '') {
        return [];
    }

    $where = [
        '`sheet` = "' . sql_escape($sheet) . '"',
        '`key` = "' . sql_escape($key) . '"',
        '`user` = "' . sql_escape($answerUser) . '"',
    ];
    if (!empty($payload['classroom']) && answer_table_has_column('classroom')) {
        $where[] = '`classroom` = ' . intval($payload['classroom']);
    }

    $rows = sql_get(
        'SELECT `value` FROM `answer` WHERE ' .
        implode(' AND ', $where) .
        ' ORDER BY `updated_at` DESC, `id` DESC LIMIT 10;'
    );
    foreach ($rows as $row) {
        $stored = decode_luecke_value_with_context($row['value'] ?? '');
        if ($stored['answer'] === trim((string)$answer) && !empty($stored['source_context'])) {
            return $stored['source_context'];
        }
    }
    return [];
}

function decode_luecke_value_with_context($rawValue)
{
    $raw = trim((string)$rawValue);
    if ($raw === '' || substr($raw, 0, 1) !== '{') {
        return [
            'answer' => $raw,
            'source_context' => [],
        ];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [
            'answer' => $raw,
            'source_context' => [],
        ];
    }

    $answer = '';
    if (isset($decoded['answer']) && is_string($decoded['answer'])) {
        $answer = $decoded['answer'];
    } elseif (isset($decoded['text']) && is_string($decoded['text'])) {
        $answer = $decoded['text'];
    }

    return [
        'answer' => trim($answer),
        'source_context' => isset($decoded['source_context']) && is_array($decoded['source_context'])
            ? $decoded['source_context']
            : [],
    ];
}

function merge_source_context($previous, $current)
{
    if (!is_array($previous) || empty($previous)) return $current;
    if (!is_array($current) || empty($current)) return $previous;

    $merged = array_merge($previous, $current);
    $previousFacts = is_array($previous['facts'] ?? null) ? $previous['facts'] : [];
    $currentFacts = is_array($current['facts'] ?? null) ? $current['facts'] : [];
    $mergedFacts = array_merge($previousFacts, array_filter($currentFacts, function ($value) {
        return $value !== null && $value !== '';
    }));
    $merged['facts'] = $mergedFacts;

    if (empty($currentFacts) && !empty($previousFacts)) {
        $merged['source_status'] = 'cached';
        $merged['source_status_detail'] = 'Aktueller Abruf hat keine verwertbaren Daten geliefert; vorhandene Kontextdaten wurden wiederverwendet.';
        if (empty($merged['summary']) && !empty($previous['summary'])) {
            $merged['summary'] = $previous['summary'];
        }
    }

    return $merged;
}

function source_context_text($sourceContext)
{
    if (!is_array($sourceContext) || empty($sourceContext)) {
        return '';
    }

    $lines = [];
    if (!empty($sourceContext['url'])) {
        $lines[] = 'URL: ' . $sourceContext['url'];
    }
    if (!empty($sourceContext['source_status'])) {
        $lines[] = 'Lesestatus: ' . $sourceContext['source_status'];
    }
    if (!empty($sourceContext['source_status_detail'])) {
        $lines[] = 'Hinweis: ' . $sourceContext['source_status_detail'];
    }
    if (!empty($sourceContext['known_property_portal'])) {
        $lines[] = 'Bekannte Immobilienplattform erkannt: ja';
    }
    if (!empty($sourceContext['direct_listing_url'])) {
        $lines[] = 'Direkter Inseratslink erkannt: ja';
    }
    if (!empty($sourceContext['listing_confidence'])) {
        $lines[] = 'Erkennungsart Inseratslink: ' . $sourceContext['listing_confidence'];
    }
    if (!empty($sourceContext['extraction_quality'])) {
        $lines[] = 'Extraktionsqualität: ' . $sourceContext['extraction_quality'];
    }
    if (!empty($sourceContext['allow_flexible_followup'])) {
        $lines[] = 'Fallback für Folgeaufgaben: ja';
    }
    if (!empty($sourceContext['fallback_reason'])) {
        $lines[] = 'Fallback-Grund: ' . $sourceContext['fallback_reason'];
    }

    $facts = is_array($sourceContext['facts'] ?? null) ? $sourceContext['facts'] : [];
    if (!empty($facts)) {
        $factLines = [];
        foreach ($facts as $key => $value) {
            if ($value === null || $value === '') continue;
            $factLines[] = source_context_fact_label($key) . ': ' . source_context_scalar($value);
        }
        if (!empty($factLines)) {
            $lines[] = "Extrahierte Daten:\n- " . implode("\n- ", $factLines);
        }
    }

    if (!empty($sourceContext['summary'])) {
        $lines[] = 'Zusammenfassung: ' . $sourceContext['summary'];
    }
    if (!empty($sourceContext['excerpt'])) {
        $lines[] = "Auszug:\n" . limit_context_text($sourceContext['excerpt'], 3000);
    }
    if (!empty($sourceContext['error'])) {
        $lines[] = 'Fehler beim Lesen: ' . $sourceContext['error'];
    }

    return implode("\n", $lines);
}

function source_context_fact_label($key)
{
    $labels = [
        'title' => 'Titel',
        'address' => 'Adresse',
        'rooms' => 'Zimmer',
        'living_area_m2' => 'Wohnfläche m2',
        'rent_chf' => 'Miete CHF',
        'floor' => 'Etage',
        'year_built' => 'Baujahr',
        'features' => 'Merkmale',
        'portal' => 'Portal',
        'portal_domain' => 'Portal-Domain',
        'listing_id' => 'Inseratenummer',
        'listing_kind' => 'Inseratsart',
        'object_type' => 'Objekttyp',
    ];
    return $labels[$key] ?? $key;
}

function source_context_scalar($value)
{
    if (is_array($value)) {
        return implode(', ', array_map('source_context_scalar', $value));
    }
    if (is_bool($value)) {
        return $value ? 'ja' : 'nein';
    }
    return trim((string)$value);
}

function extract_data_json_from_feedback($text)
{
    $raw = (string)$text;
    if (!preg_match('/DATEN_JSON:\s*(\{[^\r\n]*\})/u', $raw, $matches)) {
        return [
            'found' => false,
            'clean_explanation' => trim($raw),
            'data' => [],
        ];
    }

    $data = json_decode($matches[1], true);
    if (!is_array($data)) {
        $data = [];
    }

    return [
        'found' => true,
        'clean_explanation' => trim(str_replace($matches[0], '', $raw)),
        'data' => $data,
    ];
}

function limit_context_text($text, $limit)
{
    $clean = trim((string)$text);
    $limit = intval($limit);
    if ($limit <= 0 || strlen($clean) <= $limit) {
        return $clean;
    }
    return rtrim(substr($clean, 0, $limit)) . '...';
}

function build_answer_feedback_messages($payload)
{
    $exerciseType = strtolower(trim((string)($payload['exercise_type'] ?? '')));
    if ($exerciseType === 'freitext') {
        return build_freitext_feedback_messages($payload);
    }
    return build_gap_feedback_messages($payload);
}

function enrich_freitext_payload_with_context_prompts($payload)
{
    if (!is_array($payload)) {
        return $payload;
    }

    $contextPrompts = freitext_context_prompts_from_database($payload);
    foreach ($contextPrompts as $field => $value) {
        $clean = trim((string)$value);
        if ($clean === '') continue;
        if (trim((string)($payload[$field] ?? '')) === '') {
            $payload[$field] = $clean;
        }
    }
    $payload['_freitext_context_prompts'] = $contextPrompts;
    return $payload;
}

function freitext_context_prompts_from_database($payload)
{
    $context = [
        'sheet_prompt' => '',
        'assignment_prompt' => '',
        'learner_prompt' => '',
        'classroom_prompt' => '',
        'school_prompt' => '',
    ];

    $sheetKey = trim((string)($payload['sheet'] ?? ''));
    $answerUser = trim((string)($payload['user'] ?? ''));
    $classroomId = intval($payload['classroom'] ?? 0);
    $sheetOwnerId = 0;

    if ($sheetKey !== '' && answer_has_table_column('sheet', 'prompt')) {
        $where = '`key` = "' . sql_escape($sheetKey) . '"';
        if (answer_has_table_column('sheet', 'is_current')) {
            $where .= ' AND is_current = 1';
        }
        $rows = sql_get(
            'SELECT `user`, `prompt` FROM `sheet` WHERE ' .
            $where .
            ' ORDER BY `updated_at` DESC, `id` DESC LIMIT 1;'
        );
        if (!empty($rows)) {
            $context['sheet_prompt'] = trim((string)($rows[0]['prompt'] ?? ''));
            $sheetOwnerId = intval($rows[0]['user'] ?? 0);
        }
    }

    if ($answerUser !== '' && strpos($answerUser, 'anon_') !== 0 && answer_has_table_column('learner', 'prompt')) {
        $where = '`code` = "' . sql_escape($answerUser) . '"';
        if ($classroomId > 0 && answer_has_table_column('learner', 'classroom')) {
            $where .= ' AND `classroom` = ' . $classroomId;
        }
        $rows = sql_get(
            'SELECT `classroom`, `prompt` FROM `learner` WHERE ' .
            $where .
            ' ORDER BY `updated_at` DESC, `id` DESC LIMIT 1;'
        );
        if (!empty($rows)) {
            $context['learner_prompt'] = trim((string)($rows[0]['prompt'] ?? ''));
            if ($classroomId <= 0) {
                $classroomId = intval($rows[0]['classroom'] ?? 0);
            }
        }
    }

    if (
        $sheetKey !== '' &&
        $classroomId > 0 &&
        answer_has_table_column('classroom_sheet', 'prompt')
    ) {
        $where = '`classroom` = ' . $classroomId .
            ' AND `sheet_key` = "' . sql_escape($sheetKey) . '"';
        if ($sheetOwnerId > 0 && answer_has_table_column('classroom_sheet', 'user')) {
            $where .= ' AND `user` = ' . $sheetOwnerId;
        }
        $rows = sql_get(
            'SELECT `prompt` FROM `classroom_sheet` WHERE ' .
            $where .
            ' ORDER BY `updated_at` DESC, `id` DESC LIMIT 1;'
        );
        if (!empty($rows)) {
            $context['assignment_prompt'] = trim((string)($rows[0]['prompt'] ?? ''));
        }
    }

    if ($classroomId > 0 && answer_db_table_exists('classroom')) {
        $select = [
            answer_has_table_column('classroom', 'prompt')
                ? 'c.`prompt` AS classroom_prompt'
                : '"" AS classroom_prompt'
        ];
        $join = '';
        if (
            answer_has_table_column('classroom', 'school') &&
            answer_db_table_exists('school') &&
            answer_has_table_column('school', 'prompt')
        ) {
            $select[] = 's.`prompt` AS school_prompt';
            $join = ' LEFT JOIN `school` s ON s.id = c.school';
        }
        $where = 'c.`id` = ' . $classroomId;
        if ($sheetOwnerId > 0 && answer_has_table_column('classroom', 'user')) {
            $where .= ' AND c.`user` = ' . $sheetOwnerId;
        }
        $rows = sql_get(
            'SELECT ' . implode(', ', $select) .
            ' FROM `classroom` c' .
            $join .
            ' WHERE ' .
            $where .
            ' LIMIT 1;'
        );
        if (!empty($rows)) {
            $context['classroom_prompt'] = trim((string)($rows[0]['classroom_prompt'] ?? ''));
            $context['school_prompt'] = trim((string)($rows[0]['school_prompt'] ?? ''));
        }
    }

    return $context;
}

function freitext_additional_prompt_text($payload)
{
    $teacherPrompt = trim((string)($payload['teacher_prompt'] ?? ''));
    $blockPrompt = trim((string)($payload['block_prompt'] ?? ''));
    $additionalPrompt = trim((string)($payload['additional_prompt'] ?? ''));
    $lines = [];
    if ($blockPrompt !== '') $lines[] = "Block-Prompt:\n" . $blockPrompt;
    if ($additionalPrompt !== '' && $teacherPrompt === '' && $blockPrompt === '') {
        $lines[] = "Zusatzprompt:\n" . $additionalPrompt;
    }
    if (trim((string)($payload['sheet_prompt'] ?? '')) !== '') {
        $lines[] = "Auftragsblatt-Prompt:\n" . trim((string)$payload['sheet_prompt']);
    }
    if (trim((string)($payload['assignment_prompt'] ?? '')) !== '') {
        $lines[] = "Zuweisungs-Prompt:\n" . trim((string)$payload['assignment_prompt']);
    }
    return implode("\n\n", $lines);
}

function freitext_individual_settings_text($payload)
{
    $items = [
        'learner_prompt' => 'Lernende Person',
        'classroom_prompt' => 'Klasse',
        'school_prompt' => 'Schule',
    ];
    $lines = [];
    foreach ($items as $field => $label) {
        $text = trim((string)($payload[$field] ?? ''));
        if ($text !== '') {
            $lines[] = $label . ":\n" . $text;
        }
    }
    return implode("\n\n", $lines);
}

function build_answer_prompt_sources($payload, $messages)
{
    $exerciseType = strtolower(trim((string)($payload['exercise_type'] ?? '')));
    $isFreitext = $exerciseType === 'freitext';
    $messageSources = [];
    foreach ($messages as $index => $message) {
        $messageSources[] = [
            'message_index' => $index,
            'role' => (string)($message['role'] ?? ''),
            'source' => $index === 0
                ? ($isFreitext
                    ? 'Backend-Festtext: build_freitext_feedback_messages() system'
                    : 'Backend-Festtext: build_gap_feedback_messages() system')
                : ($isFreitext
                    ? 'Backend-Zusammensetzung aus Freitext-Payloadfeldern: build_freitext_feedback_messages() user'
                    : 'Backend-Zusammensetzung aus Luecke/Antwort-Payloadfeldern: build_gap_feedback_messages() user'),
            'element' => $index === 0 ? null : ($isFreitext
                ? 'freitext-block und textarea.freitext__textarea'
                : answer_prompt_gap_root_element($payload)),
            'text' => (string)($message['content'] ?? ''),
        ];
    }

    return [
        'log_only' => true,
        'note' => 'Diese Quellen-Metadaten werden nur geloggt und nicht an OpenAI gesendet. Die gesendeten Nachrichten stehen unverändert unter request.messages.',
        'message_sources' => $messageSources,
        'parts' => $isFreitext
            ? build_freitext_prompt_source_parts($payload)
            : build_gap_prompt_source_parts($payload),
    ];
}

function answer_prompt_part($id, $label, $messageIndex, $source, $element, $payloadField, $text, $sourceType = 'payload', $note = '')
{
    return [
        'id' => $id,
        'label' => $label,
        'message_index' => $messageIndex,
        'source_type' => $sourceType,
        'source' => $source,
        'element' => $element,
        'payload_field' => $payloadField,
        'text' => (string)$text,
        'empty' => trim((string)$text) === '',
        'note' => $note,
    ];
}

function answer_prompt_gap_variant($payload)
{
    if (array_key_exists('lueckentext', $payload)) {
        return 'luecke';
    }
    return 'umfrage_oder_generische_antwort';
}

function answer_prompt_gap_root_element($payload)
{
    $variant = answer_prompt_gap_variant($payload);
    if ($variant === 'luecke') {
        return 'luecke-gap / input.luecke';
    }
    return 'umfrage-matrix / input.umfrage-input oder generisches Antwortfeld';
}

function answer_prompt_answer_element($payload)
{
    $key = trim((string)($payload['key'] ?? ''));
    $selectorKey = $key !== '' ? '[name="' . $key . '"]' : '';
    $variant = answer_prompt_gap_variant($payload);
    if ($variant === 'luecke') {
        return 'input.luecke' . $selectorKey . ' in luecke-gap' . $selectorKey;
    }
    return 'input.umfrage-input[data-key="' . $key . '"] oder input.umfrage-input' . $selectorKey;
}

function answer_prompt_gap_solution_element($payload)
{
    $key = trim((string)($payload['key'] ?? ''));
    $selectorKey = $key !== '' ? '[name="' . $key . '"]' : '';
    $variant = answer_prompt_gap_variant($payload);
    if ($variant === 'luecke') {
        return 'Originalinhalt von luecke-gap' . $selectorKey . ' -> input.dataset.solution';
    }
    return null;
}

function build_gap_prompt_source_parts($payload)
{
    $antwort = trim((string)($payload['value'] ?? ''));
    $lueckentext = trim((string)($payload['lueckentext'] ?? ''));
    $musterloesung = trim((string)($payload['musterloesung'] ?? ''));
    $gapPrompt = trim((string)($payload['prompt'] ?? ($payload['gap_prompt'] ?? '')));
    $sourceContextText = trim((string)($payload['_source_context_text'] ?? ''));
    $targetName = trim((string)($payload['key'] ?? ''));

    $gapPromptText = $gapPrompt !== '' ? $gapPrompt : 'Kein zusätzlicher Prüfauftrag angegeben.';
    $sourceContextPromptText = $sourceContextText !== ''
        ? $sourceContextText
        : 'Kein Linkkontext verfügbar.';

    return [
        answer_prompt_part(
            'gap_lueckentext',
            'Kompletter Lückentext',
            1,
            'Frontend: buildLueckentext(options.root)',
            'main.sheet p/li innerhalb der Arbeitsblatt-Runtime; luecke-gap/input.luecke werden mit aktuellen Eingaben ersetzt',
            'lueckentext',
            $lueckentext,
            array_key_exists('lueckentext', $payload) ? 'payload' : 'backend_fallback',
            'Bei Umfragen ist dieser Abschnitt leer, weil diese Elemente keinen kompletten Lückentext liefern.'
        ),
        answer_prompt_part(
            'gap_target_name',
            'Zu prüfendes Feld',
            1,
            'Frontend-Payload: key',
            answer_prompt_answer_element($payload),
            'key',
            $targetName
        ),
        answer_prompt_part(
            'gap_student_answer',
            'Antwort der lernenden Person',
            1,
            'Frontend-Payload: value',
            answer_prompt_answer_element($payload),
            'value',
            $antwort
        ),
        answer_prompt_part(
            'gap_teacher_solution',
            'Lehrerlösung / interne Orientierung',
            1,
            'Frontend-Payload: musterloesung',
            answer_prompt_gap_solution_element($payload),
            'musterloesung',
            $musterloesung,
            array_key_exists('musterloesung', $payload) ? 'payload' : 'backend_fallback',
            'Wird im Prompt als interne Orientierung bezeichnet und darf nicht wörtlich ausgegeben werden.'
        ),
        answer_prompt_part(
            'gap_teacher_prompt',
            'Zusätzlicher Prüfauftrag der Lehrperson',
            1,
            $gapPrompt !== ''
                ? 'Frontend-Payload: prompt/gap_prompt'
                : 'Backend-Fallback, weil prompt/gap_prompt leer ist',
            answer_prompt_gap_variant($payload) === 'luecke'
                ? 'Attribut prompt oder data-prompt auf luecke-gap -> input.dataset.prompt'
                : null,
            array_key_exists('prompt', $payload) ? 'prompt' : 'gap_prompt',
            $gapPromptText,
            $gapPrompt !== '' ? 'payload' : 'backend_fallback'
        ),
        answer_prompt_part(
            'gap_link_context',
            'Gelesener Kontext aus Link/Inserat',
            1,
            $sourceContextText !== ''
                ? 'Backend: build_gap_source_context() aus URL in payload.value'
                : 'Backend-Fallback, weil kein Linkkontext verfügbar ist',
            $sourceContextText !== '' ? answer_prompt_answer_element($payload) : null,
            '_source_context_text',
            $sourceContextPromptText,
            $sourceContextText !== '' ? 'backend_enrichment' : 'backend_fallback'
        ),
        answer_prompt_part(
            'gap_final_instruction',
            'Schlussanweisung zur Bewertung',
            1,
            'Backend-Festtext: build_gap_feedback_messages() user',
            null,
            null,
            'Beurteile knapp, ob die Antwort im Kontext des gesamten Lückentextes inhaltlich korrekt ist. Nutze die Lehrerlösung und den zusätzlichen Prüfauftrag als Orientierung und akzeptiere auch andere richtige Formulierungen oder zusätzliche passende Informationen. Gib eine kurze Rückmeldung mit maximal einem Hinweis oder Tipp. Nenne nicht die exakte Lösung und formuliere keine vollständige Musterantwort.',
            'backend_template'
        ),
    ];
}

function build_freitext_prompt_source_parts($payload)
{
    $rawValue = $payload['value'] ?? '';
    $storedValue = decode_freitext_value($rawValue);
    $antwort = trim((string)($payload['answer_text'] ?? ''));
    $answerSource = 'Frontend-Payload: answer_text';
    $answerField = 'answer_text';
    if ($antwort === '') {
        $storedAnswer = trim((string)($storedValue['answer'] ?? ''));
        if ($storedAnswer !== '') {
            $antwort = $storedAnswer;
            $answerSource = 'Backend-Fallback: aus JSON in payload.value gelesen';
            $answerField = 'value.answer';
        }
    }
    if ($antwort === '' && empty($storedValue['structured'])) {
        $antwort = trim((string)$rawValue);
        $answerSource = 'Backend-Fallback: payload.value als Rohtext';
        $answerField = 'value';
    }

    $title = trim((string)($payload['title'] ?? ($payload['key'] ?? 'Freitext')));
    $titleField = array_key_exists('title', $payload) ? 'title' : 'key';
    $taskPrompt = trim((string)($payload['task_prompt'] ?? ($payload['instruction_text'] ?? '')));
    $teacherPrompt = trim((string)($payload['teacher_prompt'] ?? ($payload['prompt'] ?? '')));
    $additionalPromptText = freitext_additional_prompt_text($payload);
    $individualSettingsText = freitext_individual_settings_text($payload);
    $criteriaText = trim((string)($payload['criteria_text'] ?? ''));
    $additionalQuestion = trim((string)($payload['additional_question'] ?? ($payload['follow_up_question'] ?? '')));
    $premisesText = trim((string)($payload['premises_text'] ?? ''));
    $premisesSource = 'Frontend-Payload: premises_text';
    $premisesField = 'premises_text';
    if ($premisesText === '' && !empty($payload['premise_values_json'])) {
        $decodedPremiseValues = json_decode((string)$payload['premise_values_json'], true);
        if (is_array($decodedPremiseValues)) {
            $premisesText = freitext_premise_values_text($decodedPremiseValues);
            $premisesSource = 'Backend-Fallback: aus premise_values_json formatiert';
            $premisesField = 'premise_values_json';
        }
    }
    if ($premisesText === '' && !empty($storedValue['premise_values'])) {
        $premisesText = freitext_premise_values_text($storedValue['premise_values']);
        $premisesSource = 'Backend-Fallback: aus JSON in payload.value gelesen';
        $premisesField = 'value.premise_values';
    }
    $minLength = trim((string)($payload['min_length'] ?? ''));
    $maxLength = trim((string)($payload['max_length'] ?? ''));

    $lengthInfo = [];
    if ($minLength !== '') $lengthInfo[] = 'Mindestlänge: ' . $minLength . ' Zeichen';
    if ($maxLength !== '') $lengthInfo[] = 'Maximallänge: ' . $maxLength . ' Zeichen';
    $lengthText = !empty($lengthInfo) ? implode("\n", $lengthInfo) : 'Keine Längenvorgaben angegeben.';
    $modeText = $antwort !== ''
        ? 'Freitext mit Prämissen prüfen.'
        : 'Vorbereitung prüfen: Es ist noch kein Text vorhanden; bewerte nur die Prämissenwerte.';

    return [
        answer_prompt_part(
            'freitext_title',
            'Aufgabentitel',
            1,
            'Frontend: textarea.dataset.title',
            'freitext-block[title] oder freitext-anweisung/freitext-instruction -> textarea.freitext__textarea.dataset.title',
            $titleField,
            $title
        ),
        answer_prompt_part(
            'freitext_task_prompt',
            'Arbeitsauftrag',
            1,
            $taskPrompt !== ''
                ? 'Frontend: textarea.dataset.task'
                : 'Backend-Fallback, weil task_prompt leer ist',
            'freitext-block[task|instruction] oder freitext-anweisung/freitext-instruction -> textarea.freitext__textarea.dataset.task',
            'task_prompt',
            $taskPrompt !== '' ? $taskPrompt : 'Kein separater Arbeitsauftrag angegeben.',
            $taskPrompt !== '' ? 'payload' : 'backend_fallback'
        ),
        answer_prompt_part(
            'freitext_teacher_prompt',
            'Zusätzlicher Prüfauftrag der Lehrperson zum Haupttext',
            1,
            $teacherPrompt !== ''
                ? 'Frontend: textarea.dataset.teacherPrompt'
                : 'Backend-Fallback, weil teacher_prompt leer ist',
            'freitext-block[prompt|teacher-prompt|data-prompt|data-teacher-prompt] -> textarea.freitext__textarea.dataset.teacherPrompt',
            array_key_exists('teacher_prompt', $payload) ? 'teacher_prompt' : 'prompt',
            $teacherPrompt !== '' ? $teacherPrompt : 'Kein zusätzlicher Prüfauftrag zum Haupttext angegeben.',
            $teacherPrompt !== '' ? 'payload' : 'backend_fallback'
        ),
        answer_prompt_part(
            'freitext_additional_prompts',
            'Weitere Prüf-Prompts',
            1,
            $additionalPromptText !== ''
                ? 'Frontend/Backend: block_prompt, sheet_prompt oder assignment_prompt'
                : 'Backend-Fallback, weil keine weiteren Prüf-Prompts vorhanden sind',
            'abu-block-prompt neben freitext-block; sheet.prompt; classroom_sheet.prompt',
            ['block_prompt', 'additional_prompt', 'sheet_prompt', 'assignment_prompt'],
            $additionalPromptText !== '' ? $additionalPromptText : 'Keine weiteren Prüf-Prompts angegeben.',
            $additionalPromptText !== '' ? 'payload_or_backend_enrichment' : 'backend_fallback'
        ),
        answer_prompt_part(
            'freitext_individual_settings',
            'Individuelle Einstellungen',
            1,
            $individualSettingsText !== ''
                ? 'Backend: aus learner/classroom/school anhand sheet/user/classroom ergänzt'
                : 'Backend-Fallback, weil keine individuellen Einstellungen gefunden wurden',
            'learner.prompt, classroom.prompt, school.prompt',
            ['learner_prompt', 'classroom_prompt', 'school_prompt'],
            $individualSettingsText !== '' ? $individualSettingsText : 'Keine individuellen Einstellungen angegeben.',
            $individualSettingsText !== '' ? 'backend_enrichment' : 'backend_fallback'
        ),
        answer_prompt_part(
            'freitext_criteria',
            'Zwingende Teile',
            1,
            $criteriaText !== ''
                ? 'Frontend: criteriaText(parseFreitextCriteria(freitext-block))'
                : 'Backend-Fallback, weil criteria_text leer ist',
            'freitext-teil, freitext-part oder freitext-kriterium innerhalb von freitext-block',
            'criteria_text',
            $criteriaText !== '' ? $criteriaText : 'Keine zwingenden Teile angegeben.',
            $criteriaText !== '' ? 'payload' : 'backend_fallback'
        ),
        answer_prompt_part(
            'freitext_additional_question',
            'Zusatzfrage der lernenden Person',
            1,
            $additionalQuestion !== ''
                ? 'Frontend: .freitext__question-field'
                : 'Backend-Fallback, weil keine Zusatzfrage gesendet wurde',
            'input.freitext__question-field innerhalb von freitext-block',
            array_key_exists('additional_question', $payload) ? 'additional_question' : 'follow_up_question',
            $additionalQuestion !== '' ? $additionalQuestion : 'Keine Zusatzfrage gestellt.',
            $additionalQuestion !== '' ? 'payload' : 'backend_fallback'
        ),
        answer_prompt_part(
            'freitext_premises',
            'Ausgangslage und ausgefüllte Werte',
            1,
            $premisesText !== '' ? $premisesSource : 'Backend-Fallback, weil keine Prämissen/Werte vorhanden sind',
            'freitext-prämisse/freitext-praemisse/freitext-premise und freitext-reference; Werte aus .freitext__premise-input sowie verknüpften Antworten',
            $premisesField,
            $premisesText !== '' ? $premisesText : 'Keine Ausgangslage oder Werte angegeben.',
            $premisesText !== '' ? 'payload_or_backend_fallback' : 'backend_fallback'
        ),
        answer_prompt_part(
            'freitext_length_frame',
            'Rahmen',
            1,
            !empty($lengthInfo)
                ? 'Frontend: textarea.dataset.minLength / textarea.dataset.maxLength'
                : 'Backend-Fallback, weil keine Längenvorgaben gesendet wurden',
            'Attribute min-length/max-length auf freitext-block -> textarea.freitext__textarea.dataset',
            ['min_length', 'max_length'],
            $lengthText,
            !empty($lengthInfo) ? 'payload' : 'backend_fallback'
        ),
        answer_prompt_part(
            'freitext_mode',
            'Prüfmodus',
            1,
            'Backend-Logik abhängig davon, ob ein aktueller Freitext vorhanden ist',
            'textarea.freitext__textarea',
            $answerField,
            $modeText,
            'backend_logic'
        ),
        answer_prompt_part(
            'freitext_answer',
            'Aktueller Text',
            1,
            $answerSource,
            'textarea.freitext__textarea innerhalb von freitext-block',
            $answerField,
            $antwort !== '' ? $antwort : '[noch kein Text geschrieben]',
            $antwort !== '' ? 'payload_or_backend_fallback' : 'backend_fallback'
        ),
        answer_prompt_part(
            'freitext_final_instruction',
            'Schlussanweisung zur Bewertung',
            1,
            'Backend-Festtext: build_freitext_feedback_messages() user',
            null,
            null,
            'Gib überarbeitungsorientiertes Mikro-Feedback zum aktuellen Stand.',
            'backend_template'
        ),
    ];
}

function build_gap_feedback_messages($payload)
{
    $antwort = trim((string)($payload['value'] ?? ''));
    $lueckentext = trim((string)($payload['lueckentext'] ?? ''));
    $musterloesung = trim((string)($payload['musterloesung'] ?? ''));
    $gapPrompt = trim((string)($payload['prompt'] ?? ($payload['gap_prompt'] ?? '')));
    $sourceContextText = trim((string)($payload['_source_context_text'] ?? ''));
    $targetName = trim((string)($payload['key'] ?? ''));

    return [
        [
            'role' => 'system',
            'content' =>
                'Du bist eine Lehrperson für Politik und Geschichte. Du bewertest kurze Antworten von Lernenden zu einem Lückentext sachlich korrekt, freundlich und knapp auf Deutsch. Du kennst eine Lehrerlösung, verwendest sie als zentrale fachliche Referenz, verrätst sie aber nie wörtlich. Antworten, die inhaltlich sehr nahe an der Lehrerlösung sind, sollen klar als richtig bewertet werden. Entscheidend ist gleichzeitig, ob die Antwort im Kontext des Lückentextes inhaltlich korrekt ist – auch andere richtige Lösungen, Umschreibungen oder Synonyme können als richtig gelten. Bewerte bewusst tolerant: Ignoriere kleine sprachliche Unterschiede wie Artikel, Präpositionen, Flexionen oder Satzzeichen. Du gibst nur eine grobe Einschätzung (richtig/teilweise richtig/falsch) und kurze Hinweise oder Denkanstösse. Wenn du RICHTIG schreibst, soll die Rückmeldung kurz positiv sein und idealerweise einen ganz kurzen inhaltlichen Hinweis zur Lösung geben. Wenn ein Wohnungsinserat als Quelle mitgegeben wird, extrahiere die wichtigsten Fakten für spätere Freitextaufgaben. Wenn der Linkkontext "Direkter Inseratslink erkannt: ja" enthält, darf fehlendes automatisches Laden, CAPTCHA oder Anti-Bot-Schutz allein den direkten Link nicht entwerten. Antworte IMMER in genau diesem Format: Erste Zeile NUR eines dieser Wörter in Grossbuchstaben: RICHTIG, TEILWEISE oder FALSCH. Zweite Zeile eine sehr kurze Rückmeldung (maximal 2 Sätze). Falls Inseratsdaten vorhanden sind, dritte Zeile exakt DATEN_JSON: gefolgt von einem kompakten JSON-Objekt mit passenden Schlüsseln wie title, address, rooms, living_area_m2, rent_chf, floor, year_built, features.',
        ],
        [
            'role' => 'user',
            'content' =>
                "Hier ist der komplette Lückentext (mit den aktuell eingetragenen Antworten):\n\n" .
                $lueckentext .
                "\n\nZu prüfende Lücke: " .
                $targetName .
                ".\nAntwort der Schülerin / des Schülers in dieser Lücke: \"" .
                $antwort .
                "\".\n\nLehrerlösung für diese Lücke (nur zur internen groben Orientierung, nicht wörtlich wiedergeben): \"" .
                $musterloesung .
                "\".\n\nZusätzlicher Prüfauftrag der Lehrperson:\n" .
                ($gapPrompt !== '' ? $gapPrompt : 'Kein zusätzlicher Prüfauftrag angegeben.') .
                "\n\nGelesener Kontext aus Link/Inserat:\n" .
                ($sourceContextText !== '' ? $sourceContextText : 'Kein Linkkontext verfügbar.') .
                "\n\nBeurteile knapp, ob die Antwort im Kontext des gesamten Lückentextes inhaltlich korrekt ist. Nutze die Lehrerlösung und den zusätzlichen Prüfauftrag als Orientierung und akzeptiere auch andere richtige Formulierungen oder zusätzliche passende Informationen. Wenn der Linkkontext einen direkten Inseratslink erkennt, bewerte ihn nicht wegen fehlender automatischer Lesbarkeit ab. Gib eine kurze Rückmeldung mit maximal einem Hinweis oder Tipp. Nenne nicht die exakte Lösung und formuliere keine vollständige Musterantwort.",
        ],
    ];
}

function build_freitext_feedback_messages($payload)
{
    $rawValue = $payload['value'] ?? '';
    $storedValue = decode_freitext_value($rawValue);
    $antwort = trim((string)($payload['answer_text'] ?? ''));
    if ($antwort === '') {
        $storedAnswer = trim((string)($storedValue['answer'] ?? ''));
        if ($storedAnswer !== '') {
            $antwort = $storedAnswer;
        }
    }
    if ($antwort === '' && empty($storedValue['structured'])) {
        $antwort = trim((string)$rawValue);
    }
    $title = trim((string)($payload['title'] ?? ($payload['key'] ?? 'Freitext')));
    $taskPrompt = trim((string)($payload['task_prompt'] ?? ($payload['instruction_text'] ?? '')));
    $teacherPrompt = trim((string)($payload['teacher_prompt'] ?? ($payload['prompt'] ?? '')));
    $additionalPromptText = freitext_additional_prompt_text($payload);
    $individualSettingsText = freitext_individual_settings_text($payload);
    $criteriaText = trim((string)($payload['criteria_text'] ?? ''));
    $additionalQuestion = trim((string)($payload['additional_question'] ?? ($payload['follow_up_question'] ?? '')));
    $premisesText = trim((string)($payload['premises_text'] ?? ''));
    if ($premisesText === '' && !empty($payload['premise_values_json'])) {
        $decodedPremiseValues = json_decode((string)$payload['premise_values_json'], true);
        if (is_array($decodedPremiseValues)) {
            $premisesText = freitext_premise_values_text($decodedPremiseValues);
        }
    }
    if ($premisesText === '' && !empty($storedValue['premise_values'])) {
        $premisesText = freitext_premise_values_text($storedValue['premise_values']);
    }
    $minLength = trim((string)($payload['min_length'] ?? ''));
    $maxLength = trim((string)($payload['max_length'] ?? ''));

    $lengthInfo = [];
    if ($minLength !== '') $lengthInfo[] = 'Mindestlänge: ' . $minLength . ' Zeichen';
    if ($maxLength !== '') $lengthInfo[] = 'Maximallänge: ' . $maxLength . ' Zeichen';

    return [
        [
            'role' => 'system',
            'content' =>
                'Du bist eine ABU-Lehrperson und gibst lernwirksames Mikro-Feedback zu einem deutschsprachigen Freitext. Beurteile den aktuellen Zwischenstand, nicht eine Endnote. Berücksichtige die Prämissen, die Ausgangslage und die ausgefüllten Werte als verbindlichen Sachkontext. Nutze die KI-Hinweise zu den Prämissen, um Zahlen, Daten, Links und Sachangaben besonders genau auf Plausibilität und Passung zu prüfen. Berücksichtige den zusätzlichen Prüfauftrag der Lehrperson zum Haupttext, weitere Prüf-Prompts und individuelle Einstellungen zur lernenden Person, Klasse oder Schule als interne Bewertungsanweisung. Wenn eine Referenz als Fallback, unzureichend auslesbar oder nicht zufriedenstellend markiert ist, bewerte freier: bekannte extrahierte Fakten bleiben verbindlich, aber fehlende oder nicht automatisch lesbare Fakten dürfen nicht streng eingefordert werden; akzeptiere plausible Angaben der lernenden Person, solange sie den gespeicherten Fakten nicht widersprechen. Wenn noch kein Text vorhanden ist, bewerte nur die ausgefüllten Prämissen als Vorbereitung und gib Feedback, ob sie stimmig, plausibel und nutzbar sind. Wenn der Text einer verbindlichen Ausgangslage oder einem ausgefüllten Wert widerspricht, darf er nicht RICHTIG sein; bei einem zentralen Widerspruch ist er FALSCH. Prüfe danach, welche zwingenden Teile vorhanden sind und welche fehlen oder zu schwach sind. Wenn eine Zusatzfrage der lernenden Person vorhanden ist, berücksichtige oder beantworte sie knapp in der zweiten Zeile, ohne das Format zu verlassen. Gib knappes, konkretes Überarbeitungsfeedback. Keine komplette Neuformulierung, keine Musterlösung, keine langen Erklärungen. Antworte IMMER exakt so: Erste Zeile NUR RICHTIG, TEILWEISE oder FALSCH. Zweite Zeile maximal 3 kurze Sätze. Nenne zuerst kurz, was stimmig ist, und dann hoechstens 2 naechste Verbesserungen.',
        ],
        [
            'role' => 'user',
            'content' =>
                "Aufgabentitel: " .
                $title .
                "\n\nArbeitsauftrag:\n" .
                ($taskPrompt !== '' ? $taskPrompt : 'Kein separater Arbeitsauftrag angegeben.') .
                "\n\nZusätzlicher Prüfauftrag der Lehrperson zum Haupttext:\n" .
                ($teacherPrompt !== '' ? $teacherPrompt : 'Kein zusätzlicher Prüfauftrag zum Haupttext angegeben.') .
                "\n\nWeitere Prüf-Prompts:\n" .
                ($additionalPromptText !== '' ? $additionalPromptText : 'Keine weiteren Prüf-Prompts angegeben.') .
                "\n\nIndividuelle Einstellungen:\n" .
                ($individualSettingsText !== '' ? $individualSettingsText : 'Keine individuellen Einstellungen angegeben.') .
                "\n\nZwingende Teile:\n" .
                ($criteriaText !== '' ? $criteriaText : 'Keine zwingenden Teile angegeben.') .
                "\n\nZusatzfrage der lernenden Person:\n" .
                ($additionalQuestion !== '' ? $additionalQuestion : 'Keine Zusatzfrage gestellt.') .
                "\n\nAusgangslage und ausgefüllte Werte:\n" .
                ($premisesText !== '' ? $premisesText : 'Keine Ausgangslage oder Werte angegeben.') .
                "\n\nRahmen:\n" .
                (!empty($lengthInfo) ? implode("\n", $lengthInfo) : 'Keine Längenvorgaben angegeben.') .
                "\n\nPrüfmodus:\n" .
                ($antwort !== '' ? 'Freitext mit Prämissen prüfen.' : 'Vorbereitung prüfen: Es ist noch kein Text vorhanden; bewerte nur die Prämissenwerte.') .
                "\n\nAktueller Text:\n\"" .
                ($antwort !== '' ? $antwort : '[noch kein Text geschrieben]') .
                "\"\n\nGib überarbeitungsorientiertes Mikro-Feedback zum aktuellen Stand.",
        ],
    ];
}

function decode_freitext_value($rawValue)
{
    $raw = trim((string)$rawValue);
    if ($raw === '' || substr($raw, 0, 1) !== '{') {
        return [
            'answer' => $raw,
            'premise_values' => [],
            'structured' => false,
        ];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [
            'answer' => $raw,
            'premise_values' => [],
            'structured' => false,
        ];
    }

    $answer = '';
    if (isset($decoded['answer']) && is_string($decoded['answer'])) {
        $answer = $decoded['answer'];
    } elseif (isset($decoded['text']) && is_string($decoded['text'])) {
        $answer = $decoded['text'];
    } else {
        $answer = '';
    }

    $premiseValues = [];
    if (isset($decoded['premise_values']) && is_array($decoded['premise_values'])) {
        $premiseValues = $decoded['premise_values'];
    } elseif (isset($decoded['premises']) && is_array($decoded['premises'])) {
        $premiseValues = $decoded['premises'];
    }

    return [
        'answer' => $answer,
        'premise_values' => $premiseValues,
        'structured' => true,
    ];
}

function freitext_premise_values_text($values)
{
    if (!is_array($values) || empty($values)) {
        return '';
    }

    $lines = [];
    $index = 1;
    foreach ($values as $key => $value) {
        $cleanKey = trim((string)$key);
        $cleanValue = trim((string)$value);
        if ($cleanKey === '' && $cleanValue === '') continue;
        $lines[] = $index . '. ' . ($cleanKey !== '' ? $cleanKey : 'Wert') . ': ' . ($cleanValue !== '' ? $cleanValue : '[fehlt]');
        $index++;
    }
    return implode("\n", $lines);
}

function is_preview_answer_request($payload, $submittedUser = '')
{
    if (!is_array($payload)) {
        return false;
    }

    $flag = strtolower(trim((string)($payload['preview_mode'] ?? $payload['previewMode'] ?? '')));
    if (in_array($flag, ['1', 'true', 'yes', 'preview'], true)) {
        return true;
    }

    $answerUser = trim((string)($submittedUser !== '' ? $submittedUser : ($payload['user'] ?? '')));
    return strpos($answerUser, 'preview:') === 0;
}

function answer_storage_payload($payload)
{
    $fields = answer_payload_fields();
    $storage = [];
    foreach ($fields as $column => $_) {
        if ($column === 'id') {
            continue;
        }
        if (array_key_exists($column, $payload)) {
            $storage[$column] = $payload[$column];
        }
    }
    return $storage;
}

function preview_answer_where_clauses($payload)
{
    $sheet = trim((string)($payload['sheet'] ?? ''));
    $key = trim((string)($payload['key'] ?? ''));
    $answerUser = trim((string)($payload['user'] ?? ''));
    if ($sheet === '' || $key === '' || $answerUser === '') {
        return [];
    }

    $where = [
        '`sheet` = "' . sql_escape($sheet) . '"',
        '`key` = "' . sql_escape($key) . '"',
        '`user` = "' . sql_escape($answerUser) . '"',
    ];
    if (answer_table_has_column('classroom')) {
        if (array_key_exists('classroom', $payload) && trim((string)$payload['classroom']) !== '') {
            $where[] = '`classroom` = ' . intval($payload['classroom']);
        } else {
            $where[] = '(`classroom` IS NULL OR `classroom` = 0)';
        }
    }
    return $where;
}

function latest_preview_answer_id($payload)
{
    $where = preview_answer_where_clauses($payload);
    if (empty($where)) {
        return 0;
    }

    $rows = sql_get(
        'SELECT `id` FROM `answer` WHERE ' .
        implode(' AND ', $where) .
        ' ORDER BY `updated_at` DESC, `id` DESC LIMIT 1;'
    );
    return intval($rows[0]['id'] ?? 0);
}

function delete_preview_answer_duplicates($payload, $keepId)
{
    $id = intval($keepId);
    if ($id <= 0) {
        return;
    }

    $where = preview_answer_where_clauses($payload);
    if (empty($where)) {
        return;
    }
    $where[] = '`id` <> ' . $id;
    sql_set('DELETE FROM `answer` WHERE ' . implode(' AND ', $where) . ';');
}

function upsert_preview_answer($payload)
{
    $storage = answer_storage_payload($payload);
    if (empty($storage)) {
        return null;
    }

    $existingId = latest_preview_answer_id($storage);
    if ($existingId > 0) {
        $update = $storage;
        unset($update['created_at']);
        sql_update('answer', $update, $existingId);
        delete_preview_answer_duplicates($storage, $existingId);
        return $existingId;
    }

    $id = sql_create('answer', $storage);
    delete_preview_answer_duplicates($storage, $id);
    return $id;
}

function latest_answer_classification($sheet, $key, $answerUser, $classroom = null)
{
    if (!answer_table_has_column('classification')) {
        return null;
    }
    $sheet = trim((string)$sheet);
    $key = trim((string)$key);
    $answerUser = trim((string)$answerUser);
    if ($sheet === '' || $key === '' || $answerUser === '') {
        return null;
    }

    $where = [
        '`sheet` = "' . sql_escape($sheet) . '"',
        '`key` = "' . sql_escape($key) . '"',
        '`user` = "' . sql_escape($answerUser) . '"',
        '`classification` IS NOT NULL',
    ];
    if ($classroom !== null && $classroom !== '' && answer_table_has_column('classroom')) {
        $where[] = '`classroom` = ' . intval($classroom);
    }

    $rows = sql_get(
        'SELECT `classification` FROM `answer` WHERE ' .
        implode(' AND ', $where) .
        ' ORDER BY `updated_at` DESC, `id` DESC LIMIT 1;'
    );
    if (empty($rows) || !isset($rows[0]['classification'])) {
        return null;
    }
    return mapClassificationScore($rows[0]['classification']);
}

function mapClassificationScore($value)
{
    if ($value === null) {
        return null;
    }

    if (is_numeric($value)) {
        $num = (int)$value;
        if ($num >= 900) return 1000;
        if ($num >= 101) return 500;
        return 0;
    }

    $upper = strtoupper(trim((string)$value));
    if ($upper === 'RICHTIG') return 1000;
    if ($upper === 'TEILWEISE') return 500;
    if ($upper === 'FALSCH') return 0;

    return null;
}

function answer_scope_clause_for_user($userId)
{
    $uid = intval($userId);
    $clauses = [];
    if (answer_table_has_column('classroom')) {
        $clauses[] = '`classroom` IN (SELECT `id` FROM `classroom` WHERE `user` = ' . $uid . ')';
    }
    if (answer_table_has_column('sheet')) {
        $clauses[] = '`sheet` IN (SELECT `key` FROM `sheet` WHERE `user` = ' . $uid . ')';
    }
    if (empty($clauses)) {
        return '1 = 0';
    }
    return '(' . implode(' OR ', $clauses) . ')';
}

function answer_payload_fields()
{
    $fields = [];
    $candidates = [
        'id',
        'key',
        'sheet',
        'value',
        'user',
        'classroom',
        'classification',
        'created_at',
        'updated_at',
    ];
    foreach ($candidates as $column) {
        if (answer_table_has_column($column)) {
            $fields[$column] = [];
        }
    }
    if (empty($fields)) {
        $fields['id'] = [];
    }
    return $fields;
}

function answer_table_has_column($column)
{
    $name = trim((string)$column);
    if ($name === '') return false;
    return answer_has_table_column('answer', $name);
}

function answer_db_table_exists($table)
{
    static $cache = [];
    $name = trim((string)$table);
    if ($name === '') return false;
    if (array_key_exists($name, $cache)) {
        return $cache[$name];
    }
    $rows = sql_get("SHOW TABLES LIKE '" . sql_escape($name) . "';");
    $cache[$name] = !empty($rows);
    return $cache[$name];
}

function answer_has_table_column($table, $column)
{
    static $cache = [];
    $tableName = trim((string)$table);
    $columnName = trim((string)$column);
    if ($tableName === '' || $columnName === '') return false;
    $key = $tableName . '.' . $columnName;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }
    if (!answer_db_table_exists($tableName)) {
        $cache[$key] = false;
        return false;
    }
    $rows = sql_get(
        'SHOW COLUMNS FROM `' . sql_escape($tableName) . '` LIKE "' . sql_escape($columnName) . '";'
    );
    $cache[$key] = !empty($rows);
    return $cache[$key];
}
