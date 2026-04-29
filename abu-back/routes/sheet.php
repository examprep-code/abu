<?php

$sheetConfig = [
    'sheet' => [
        'id' => [],
        'user' => [],
        'key' => [],
        'name' => [],
        'content' => [],
        'prompt' => [],
        'is_current' => [],
        'created_at' => [],
        'updated_at' => [],
    ],
];

function sheet_strip_empty_freitext_premise_placeholders($content)
{
    $pattern = '~[ \t]*<freitext-(prämisse|praemisse)\b(?=[^>]*\blabel\s*=\s*(["\'])(?:Prämisse|Praemisse)\s+1\2)(?![^>]*\b(?:key|name|source-key|answer-key|target|ref|source|href|url|source-label|link-label|type|required|optional)\s*=)[^>]*(?:/\s*>|>\s*</freitext-\1\s*>)[ \t]*(?:\R)?~iu';
    return preg_replace($pattern, '', (string) $content);
}

if (!isset($user['id'])) {
    $return['status'] = 401;
    warning('nicht eingeloggt');
    return;
}

if ($method === 'GET') {
    $key = isset($_GET['key']) ? trim($_GET['key']) : '';
    $where = [];
    $scopeToCurrentUser = !user_is_admin() || !empty($paras[0]) || $key !== '';
    if ($scopeToCurrentUser) {
        $where[] = 'user = ' . intval($user['id']);
    }
    if (!empty($paras[0])) {
        $where[] = 'id = ' . intval($paras[0]);
    } elseif ($key !== '') {
        $where[] = '`key` = "' . sql_escape($key) . '"';
        $sheetConfig['sheet']['_append'] = ['ORDER BY created_at DESC'];
    } else {
        $where[] = 'is_current = 1';
    }
    $sheetConfig['sheet']['_where'] = $where;
    $result = get($sheetConfig);
    if (!empty($paras[0])) {
        $return['data'] = $result['sheet'][0] ?? [];
    } else {
        $return['data'] = $result;
    }
    return;
}

if ($method === 'POST') {
    $key = trim($data['key'] ?? '');
    $name = trim($data['name'] ?? '');
    if ($name === '') {
        $name = 'Neues Sheet';
    }

    if ($key === '') {
        $key = strtolower(random(12));
    }

    $existing = sql_get(
        'SELECT id FROM `sheet` WHERE user = ' .
            intval($user['id']) .
            ' AND `key` = "' .
            sql_escape($key) .
            '" LIMIT 1;'
    );
    if (!empty($existing)) {
        $return['status'] = 409;
        warning('key bereits vergeben');
        return;
    }

    $now = date('Y-m-d H:i:s');
    $payload = [
        'user' => ['id' => $user['id']],
        'key' => $key,
        'name' => $name,
        'content' => sheet_strip_empty_freitext_premise_placeholders($data['content'] ?? ''),
        'prompt' => (string) ($data['prompt'] ?? ''),
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
        [$payload],
        'POST'
    );

    return;
}

if ($method === 'PUT' || $method === 'PATCH') {
    $id = $data['id'] ?? ($paras[0] ?? null);
    if (!$id) {
        $return['status'] = 400;
        warning('id fehlt');
        return;
    }

    $current = sql_get(
        'SELECT id, `key`, `name`, content, prompt FROM `sheet` WHERE id = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ' LIMIT 1;'
    );
    if (!count($current)) {
        $return['status'] = 404;
        warning('sheet nicht gefunden');
        return;
    }
    $current = $current[0];

    $restore = isset($data['is_current']) && intval($data['is_current']) === 1;
    if ($restore && !array_key_exists('content', $data) && !array_key_exists('name', $data)) {
        $now = date('Y-m-d H:i:s');
        $restoredContent = sheet_strip_empty_freitext_premise_placeholders($current['content'] ?? '');
        sql_set(
            'UPDATE `sheet` SET is_current = 0 WHERE user = ' .
                intval($user['id']) .
                ' AND `key` = "' .
                sql_escape($current['key']) .
                '";'
        );
        sql_set(
            'UPDATE `sheet` SET is_current = 1, content = "' .
                sql_escape($restoredContent) .
                '", updated_at = "' .
                sql_escape($now) .
                '" WHERE id = ' .
                intval($id) .
                ';'
        );
        return;
    }

    if (!array_key_exists('content', $data)) {
        $return['status'] = 400;
        warning('content fehlt');
        return;
    }

    $now = date('Y-m-d H:i:s');
    $payload = [
        'user' => ['id' => $user['id']],
        'key' => $current['key'],
        'name' => trim($data['name'] ?? $current['name']),
        'content' => sheet_strip_empty_freitext_premise_placeholders($data['content']),
        'prompt' => array_key_exists('prompt', $data) ? (string) ($data['prompt'] ?? '') : (string) ($current['prompt'] ?? ''),
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
        [$payload],
        'POST'
    );

    $newId = $return['data']['id'] ?? null;
    if ($newId) {
        sql_set(
            'UPDATE `sheet` SET is_current = 0 WHERE user = ' .
                intval($user['id']) .
                ' AND `key` = "' .
                sql_escape($current['key']) .
                '" AND id != ' .
                intval($newId) .
                ';'
        );
    }
    return;
}

if ($method === 'DELETE') {
    $id = $data['id'] ?? ($paras[0] ?? null);
    if (!$id) {
        $return['status'] = 400;
        warning('id fehlt');
        return;
    }

    $current = sql_get(
        'SELECT id, `key` FROM `sheet` WHERE id = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ' LIMIT 1;'
    );
    if (!count($current)) {
        $return['status'] = 404;
        warning('sheet nicht gefunden');
        return;
    }
    $current = $current[0];

    sql_set(
        'DELETE FROM `classroom_sheet` WHERE user = ' .
            intval($user['id']) .
            ' AND sheet_key = "' .
            sql_escape($current['key']) .
            '";'
    );
    sql_set(
        'DELETE FROM `collection_sheet` WHERE user = ' .
            intval($user['id']) .
            ' AND sheet_key = "' .
            sql_escape($current['key']) .
            '";'
    );

    sql_set(
        'DELETE FROM `sheet` WHERE user = ' .
            intval($user['id']) .
            ' AND `key` = "' .
            sql_escape($current['key']) .
            '";'
    );
    return;
}

$return['status'] = 405;
warning('Methode nicht erlaubt');
?>
