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

$prompt = trim($data['prompt'] ?? '');
if ($prompt === '') {
    $return['status'] = 400;
    warning('prompt fehlt');
    return;
}

$context = is_array($data['context'] ?? null) ? $data['context'] : [];
$html = (string)($context['html'] ?? '');
$view = (string)($context['view'] ?? '');
$activeBlockIndex = $context['activeBlockIndex'] ?? null;
$activeBlockHtml = (string)($context['activeBlockHtml'] ?? '');
$blockCount = $context['blockCount'] ?? null;
$visualTarget = (string)($context['visualTarget'] ?? '');

$apiKey = getenv('OPENAI_API_KEY') ?: (defined('OPENAI_API_KEY') ? OPENAI_API_KEY : '');
if (!$apiKey) {
    $return['status'] = 500;
    warning('Kein OpenAI API-Key im Backend gesetzt.');
    return;
}

$systemMessage =
    'Du bist ein Assistent fuer Lehrpersonen und bearbeitest Arbeitsblaetter im HTML-Format. ' .
    'Du erhaeltst eine Benutzeranfrage und den aktuellen HTML-Inhalt. ' .
    'Antworte AUSSCHLIESSLICH als JSON mit diesen Feldern: ' .
    '"action" (replace_html | insert_html | message), ' .
    '"html" (string, leer falls keine Aenderung), ' .
    '"message" (kurze Antwort auf Deutsch), ' .
    '"block_level" (true/false, ob html ein eigener Block ist), ' .
    '"view" (html | visual, welche Editor-Ansicht sich fuer das Snippet eignet). ' .
    'Nutze replace_html, wenn der gesamte Inhalt korrigiert oder umgeschrieben werden soll. ' .
    'Nutze insert_html, wenn nur ein neuer Abschnitt/ eine Liste/ ein Zusatz eingefuegt werden soll. ' .
    'Nutze message, wenn die Anfrage nur Analyse oder Fehlersuche erfordert und keine Aenderung. ' .
    'Gib bei insert_html nur das Snippet zur Einfuegung zurueck, kein komplettes Dokument. ' .
    'Bei replace_html gib den vollstaendigen aktualisierten HTML-Inhalt zurueck. ' .
    'Behalte bestehende Spezial-Tags (z.B. luecke-gap) bei und veraendere sie nur, wenn die Anfrage es erfordert. ' .
    'Kein Markdown, kein Code-Fence, nur JSON.';

$contextLines = [
    'Anfrage: ' . $prompt,
    'Ansicht: ' . ($view !== '' ? $view : 'unbekannt'),
];
if ($visualTarget !== '') {
    $contextLines[] = 'Einfuegen: ' . $visualTarget;
}
if ($activeBlockIndex !== null && $activeBlockIndex !== '') {
    $contextLines[] = 'Aktiver Block Index: ' . $activeBlockIndex;
}
if ($blockCount !== null && $blockCount !== '') {
    $contextLines[] = 'Block-Anzahl: ' . $blockCount;
}
if ($activeBlockHtml !== '') {
    $contextLines[] = "Aktiver Block HTML:\n" . $activeBlockHtml;
}
$contextLines[] = "Aktueller HTML-Inhalt:\n" . $html;

$notesPath = dirname(__DIR__) . '/AGENT_README.md';
if (is_readable($notesPath)) {
    $notes = trim((string)file_get_contents($notesPath));
    if ($notes !== '') {
        $contextLines[] = "KI-Notizen:\n" . $notes;
    }
}

$messages = [
    [
        'role' => 'system',
        'content' => $systemMessage,
    ],
    [
        'role' => 'user',
        'content' => implode("\n\n", $contextLines),
    ],
];

$body = json_encode([
    'model' => 'gpt-4.1-mini',
    'messages' => $messages,
    'temperature' => 0.2,
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
    CURLOPT_TIMEOUT => 30,
]);

$result = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($result === false) {
    $return['status'] = 500;
    warning('Fehler beim Aufruf der OpenAI-API: ' . $curlError);
    return;
}

if ($status < 200 || $status >= 300) {
    $return['status'] = $status;
    if ($status == 429) {
        warning('OpenAI-Rate-Limit erreicht (429). Bitte kurz warten und erneut probieren.');
    } else {
        warning('Fehler bei der OpenAI-API (' . $status . ').');
    }
    return;
}

$decoded = json_decode($result, true);
if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
    $return['status'] = 500;
    warning('Antwort der OpenAI-API konnte nicht gelesen werden: ' . json_last_error_msg());
    return;
}

$raw = trim($decoded['choices'][0]['message']['content'] ?? '');
if ($raw === '') {
    $return['status'] = 500;
    warning('Leere Antwort der OpenAI-API erhalten.');
    return;
}

if (strpos($raw, '```') === 0) {
    $raw = preg_replace('/^```[a-zA-Z]*\s*/', '', $raw);
    $raw = preg_replace('/```$/', '', $raw);
    $raw = trim($raw);
}

$parsed = json_decode($raw, true);
if ($parsed === null && json_last_error() !== JSON_ERROR_NONE) {
    $start = strpos($raw, '{');
    $end = strrpos($raw, '}');
    if ($start !== false && $end !== false && $end > $start) {
        $slice = substr($raw, $start, $end - $start + 1);
        $parsed = json_decode($slice, true);
    }
}

if ($parsed === null || !is_array($parsed)) {
    $return['status'] = 500;
    warning('Antwort der OpenAI-API ist kein gueltiges JSON.');
    return;
}

$return['data'] = [
    'action' => (string)($parsed['action'] ?? ''),
    'html' => is_string($parsed['html'] ?? null) ? $parsed['html'] : '',
    'message' => is_string($parsed['message'] ?? null) ? $parsed['message'] : '',
    'block_level' => (bool)($parsed['block_level'] ?? false),
    'view' => ($parsed['view'] ?? '') === 'visual' ? 'visual' : 'html',
];

?>
