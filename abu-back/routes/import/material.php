<?php

$modelPolicyModule = dirname(__DIR__, 2) . '/snippets/agent/model_policy.php';
if (is_readable($modelPolicyModule)) {
    include_once $modelPolicyModule;
}
$tokenCounterModule = dirname(__DIR__, 2) . '/snippets/agent/token_counter.php';
if (is_readable($tokenCounterModule)) {
    include_once $tokenCounterModule;
}
include_once dirname(__DIR__, 2) . '/datian-core/agent_openai_json.php';
include_once dirname(__DIR__, 2) . '/datian-core/material_import.php';

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

$apiKey = getenv('OPENAI_API_KEY') ?: (defined('OPENAI_API_KEY') ? OPENAI_API_KEY : '');
if (!$apiKey) {
    $return['status'] = 500;
    warning('Kein OpenAI API-Key im Backend gesetzt.');
    return;
}

$files = material_import_normalize_files('files');
if (empty($files)) {
    $return['status'] = 400;
    warning('Keine Dateien erhalten (FormData field: files).');
    return;
}

$maxBytes = 15 * 1024 * 1024;
$maxTextChars = 45000;
$created = [];
$errors = [];

$modelCandidates = function_exists('agent_model_chain_for')
    ? agent_model_chain_for('agent')
    : ['gpt-4.1-mini'];

$now = date('Y-m-d H:i:s');
$lastUsageStats = null;

foreach ($files as $file) {
    $originalName = (string)($file['name'] ?? '');
    $safeName = material_import_sanitize_filename($originalName);
    $size = (int)($file['size'] ?? 0);
    $err = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);

    if ($err !== UPLOAD_ERR_OK) {
        $errors[] = [
            'file' => $originalName,
            'error' => 'Upload fehlgeschlagen (code ' . $err . ').',
        ];
        continue;
    }

    if ($size <= 0 || $size > $maxBytes) {
        $errors[] = [
            'file' => $originalName,
            'error' => 'Datei ist zu gross oder leer (Limit: ' . $maxBytes . ' Bytes).',
        ];
        continue;
    }

    $tmp = (string)($file['tmp_name'] ?? '');
    if ($tmp === '' || !is_uploaded_file($tmp)) {
        $errors[] = [
            'file' => $originalName,
            'error' => 'Upload tmp_name ungültig.',
        ];
        continue;
    }

    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    if (!in_array($ext, ['pdf', 'docx'], true)) {
        $errors[] = [
            'file' => $originalName,
            'error' => 'Nur .pdf und .docx sind erlaubt.',
        ];
        continue;
    }

    $work = tempnam(sys_get_temp_dir(), 'abu_import_');
    if ($work === false) {
        $errors[] = [
            'file' => $originalName,
            'error' => 'Konnte keine temp Datei erstellen.',
        ];
        continue;
    }

    $moved = @move_uploaded_file($tmp, $work);
    if (!$moved) {
        @unlink($work);
        $errors[] = [
            'file' => $originalName,
            'error' => 'Konnte Upload-Datei nicht bewegen.',
        ];
        continue;
    }

    $extract = $ext === 'pdf'
        ? material_import_extract_pdf($work)
        : material_import_extract_docx($work);

    @unlink($work);

    $text = material_import_clean_text((string)($extract['text'] ?? ''));
    $warn = trim((string)($extract['warning'] ?? ''));
    if ($text === '') {
        $errors[] = [
            'file' => $originalName,
            'error' => $warn !== '' ? $warn : 'Kein Text extrahiert.',
        ];
        continue;
    }

    $truncated = false;
    if (strlen($text) > $maxTextChars) {
        $text = substr($text, 0, $maxTextChars);
        $truncated = true;
    }

    $system = implode(' ', [
        'Du bist ein Assistent, der Unterrichtsmaterial in ABU-Arbeitsblätter (HTML) umwandelt.',
        'Antworte AUSSCHLIESSLICH als JSON (kein Markdown, keine Code-Fences) mit den Feldern:',
        '"name" (string), "content_html" (string), "prompt" (string, optional), "stats" (object, optional).',
        'content_html ist ein HTML-Fragment (ohne <html>/<body>) mit normalen Tags (h2,p,ul,li,table).',
        'Erzeuge Lücken mit <luecke-gap>LOESUNG</luecke-gap>. Für volle Breite: <luecke-gap width="100%">LOESUNG</luecke-gap>.',
        'Die Lösung steht im TextContent des Tags (nicht als Attribut). Kein Script, kein CSS.',
        'Formuliere alle Arbeitsaufträge für Lernende in der Höflichkeitsform mit Sie/Ihnen/Ihre.',
        'Mindestens 8 und maximal 20 Lücken. Schreibe auf Deutsch.',
    ]);

    $userMsg = "Bitte erstelle aus diesem Material ein Arbeitsblatt mit Lücken (ABU-tauglich).\n" .
        "Datei: " . $originalName . "\n" .
        ($truncated ? "Hinweis: Text wurde serverseitig gekuerzt.\n" : '') .
        ($warn !== '' ? "Hinweis: Extraktion: " . $warn . "\n" : '') .
        "\nMaterial:\n" . $text;

    $payload = [
        'messages' => [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $userMsg],
        ],
        'temperature' => 0.2,
        'response_format' => [
            'type' => 'json_object',
        ],
    ];

    $openai = agent_openai_chat_json($apiKey, $modelCandidates, $payload);
    if (empty($openai['ok'])) {
        $errors[] = [
            'file' => $originalName,
            'error' => 'OpenAI Fehler: ' . (string)($openai['error_kind'] ?? 'unknown'),
            'model' => (string)($openai['selected_model'] ?? ''),
        ];
        continue;
    }
    $usageStats = function_exists('ai_token_counter_record_openai_response')
        ? ai_token_counter_record_openai_response(
            intval($user['id'] ?? 0),
            is_array($openai['openai_response'] ?? null) ? $openai['openai_response'] : null,
            (string)($openai['selected_model'] ?? '')
        )
        : null;
    if (is_array($usageStats)) {
        $lastUsageStats = $usageStats;
    }

    $parsed = is_array($openai['assistant_parsed'] ?? null) ? $openai['assistant_parsed'] : [];
    $sheetName = trim((string)($parsed['name'] ?? ''));
    if ($sheetName === '') {
        $sheetName = preg_replace('/\\.[a-z0-9]+$/i', '', $safeName);
        $sheetName = $sheetName !== '' ? $sheetName : 'Importiertes Material';
    }
    $contentHtml = (string)($parsed['content_html'] ?? '');
    if (trim($contentHtml) === '') {
      $errors[] = [
        'file' => $originalName,
        'error' => 'Agent hat kein content_html geliefert.',
        'model' => (string)($openai['selected_model'] ?? ''),
      ];
      continue;
    }
    $contentHtml = material_import_sanitize_sheet_html($contentHtml);
    if (trim($contentHtml) === '') {
        $errors[] = [
            'file' => $originalName,
            'error' => 'content_html war nach Sanitizing leer.',
            'model' => (string)($openai['selected_model'] ?? ''),
        ];
        continue;
    }

    $key = strtolower(random(12));
    $prompt = trim((string)($parsed['prompt'] ?? ''));
    if ($prompt === '') {
        $prompt = 'Import: ' . $originalName;
    }

    $payloadSheet = [
        'user' => ['id' => $user['id']],
        'key' => $key,
        'name' => $sheetName,
        'content' => $contentHtml,
        'prompt' => $prompt,
        'is_current' => 1,
        'created_at' => $now,
        'updated_at' => $now,
    ];

    set(
        'sheet',
        [
            'user' => [],
            'key' => [],
            'name' => [],
            'content' => [],
            'prompt' => [],
            'is_current' => [],
            'created_at' => [],
            'updated_at' => [],
        ],
        [$payloadSheet],
        'POST'
    );

    $newId = $return['data']['id'] ?? null;
    $created[] = [
        'id' => $newId,
        'key' => $key,
        'name' => $sheetName,
        'model' => (string)($openai['selected_model'] ?? ''),
        'source_file' => $originalName,
        'truncated' => $truncated,
        'warning' => $warn,
    ];
}

if (empty($created)) {
    $return['status'] = 422;
    warning('Kein Sheet erzeugt.');
    $return['data'] = ['errors' => $errors];
    if (is_array($lastUsageStats)) {
        $return['data']['ai_usage'] = $lastUsageStats;
    }
    return;
}

$return['data'] = [
    'sheets' => $created,
    'errors' => $errors,
];
if (is_array($lastUsageStats)) {
    $return['data']['ai_usage'] = $lastUsageStats;
}

?>
