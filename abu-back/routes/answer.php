<?php

$answerConfig = [
    'answer' => ['all'],
];
$modelPolicyModule = dirname(__DIR__) . '/snippets/agent/model_policy.php';
if (is_readable($modelPolicyModule)) {
    include_once $modelPolicyModule;
}

// POST: speichern und KI-Bewertung zurückgeben
if ($method === 'POST') {
    $chatgpt = bewerteAntwortMitKI($data);

    if (empty($data['user'])) {
        $data['user'] = 'testnutzer';
    }
    if (array_key_exists('classroom', $data)) {
        $classroomId = intval($data['classroom']);
        if ($classroomId > 0) {
            $data['classroom'] = $classroomId;
        } else {
            unset($data['classroom']);
        }
    }

    // Speichere die KI-Klassifizierung direkt mit der Antwort
    if (isset($chatgpt['classification'])) {
        $data['classification'] = $chatgpt['classification']; // numeric 0/500/1000
    }

    // Timestamps setzen
    $now = date('Y-m-d H:i:s');
    $data['created_at'] = $now;
    $data['updated_at'] = $now;

    serve($answerConfig, ['POST']);

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
    $user = $paras[1] ?? ($_GET['user'] ?? null);
    $classroom = $_GET['classroom'] ?? null;

    if (!empty($sheet)) {
        $where[] = '`sheet` = "' . sql_escape($sheet) . '"';
    }
    if (!empty($user)) {
        $where[] = '`user` = "' . sql_escape($user) . '"';
    }
    if (!empty($classroom)) {
        $where[] = '`classroom` = ' . intval($classroom);
    }

    if ($userId > 0) {
        $where[] = answer_scope_clause_for_user($userId);
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

    $antwort = trim($payload['value'] ?? '');
    $lueckentext = trim($payload['lueckentext'] ?? '');
    $musterloesung = trim($payload['musterloesung'] ?? '');
    $targetName = $payload['key'] ?? '';

    $messages = [
        [
            'role' => 'system',
            'content' =>
                'Du bist eine Lehrperson für Politik und Geschichte. Du bewertest kurze Antworten von Lernenden zu einem Lückentext sachlich korrekt, freundlich und knapp auf Deutsch. Du kennst eine Lehrerlösung, verwendest sie als zentrale fachliche Referenz, verrätst sie aber nie wörtlich. Antworten, die inhaltlich sehr nahe an der Lehrerlösung sind, sollen klar als richtig bewertet werden. Entscheidend ist gleichzeitig, ob die Antwort im Kontext des Lückentextes inhaltlich korrekt ist – auch andere richtige Lösungen, Umschreibungen oder Synonyme können als richtig gelten. Bewerte bewusst tolerant: Ignoriere kleine sprachliche Unterschiede wie Artikel, Präpositionen, Flexionen oder Satzzeichen. Du gibst nur eine grobe Einschätzung (richtig/teilweise richtig/falsch) und kurze Hinweise oder Denkanstösse. Wenn du RICHTIG schreibst, soll die Rückmeldung kurz positiv sein und idealerweise einen ganz kurzen inhaltlichen Hinweis zur Lösung geben (z.B. welches historische Ereignis oder welcher Begriff gemeint ist). Antworte IMMER in genau diesem Format: Erste Zeile NUR eines dieser Wörter in Grossbuchstaben: RICHTIG, TEILWEISE oder FALSCH. Zweite Zeile eine sehr kurze Rückmeldung (maximal 2 Sätze).',
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
                "\".\n\nBeurteile knapp, ob die Antwort im Kontext des gesamten Lückentextes inhaltlich korrekt ist. Nutze die Lehrerlösung nur als Orientierung und akzeptiere auch andere richtige Formulierungen oder zusätzliche passende Informationen. Gib eine kurze Rückmeldung mit maximal einem Hinweis oder Tipp. Nenne nicht die exakte Lösung und formuliere keine vollständige Musterantwort.",
        ],
    ];

    $modelCandidates = function_exists('agent_model_chain_for')
        ? agent_model_chain_for('grading')
        : ['gpt-4.1-mini'];
    $selectedModel = '';
    $decoded = null;
    $result = '';
    $finalError = 'Fehler bei der OpenAI-API.';

    foreach ($modelCandidates as $index => $modelName) {
        $body = json_encode([
            'model' => $modelName,
            'messages' => $messages,
            'temperature' => 0,
        ]);
        if (!is_string($body) || $body === '') {
            $finalError = 'OpenAI-Request konnte nicht serialisiert werden.';
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
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_TIMEOUT => 20,
        ]);

        $tryResult = curl_exec($ch);
        $tryStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $tryCurlErrno = curl_errno($ch);
        $tryCurlError = curl_error($ch);
        curl_close($ch);

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
    $erklaerung = $rohText;

    if (in_array($ersteZeile, ['RICHTIG', 'TEILWEISE', 'FALSCH'])) {
        $classificationLabel = $ersteZeile;
        $erklaerung = trim(implode("\n", array_slice($lines, 1)));
    }

    // Mapping der Klassifizierung auf Skala 0–1000
    if ($classificationLabel === 'RICHTIG') {
        $classificationScore = 1000;
    } elseif ($classificationLabel === 'TEILWEISE') {
        $classificationScore = 500;
    } elseif ($classificationLabel === 'FALSCH') {
        $classificationScore = 0;
    }

    return [
        'classification' => $classificationScore,
        'classification_label' => $classificationLabel,
        'explanation' => $erklaerung,
        'raw' => $rohText,
        'model' => $selectedModel,
    ];
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
    return '('
        . '`classroom` IN (SELECT `id` FROM `classroom` WHERE `user` = ' . $uid . ')'
        . ' OR '
        . '`sheet` IN (SELECT `key` FROM `sheet` WHERE `user` = ' . $uid . ')'
        . ')';
}
