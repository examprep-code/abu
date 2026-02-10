<?php

$sheetConfig = [
    'sheet' => [
        'id' => [],
        'user' => [],
        'key' => [],
        'name' => [],
        'content' => [],
        'is_current' => [],
        'created_at' => [],
        'updated_at' => [],
    ],
];

if (!isset($user['id'])) {
    $return['status'] = 401;
    warning('nicht eingeloggt');
    return;
}

if ($method === 'GET') {
    $where = ['user = ' . intval($user['id'])];
    $key = isset($_GET['key']) ? trim($_GET['key']) : '';
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
        'content' => $data['content'] ?? '',
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
        'SELECT id, `key`, `name`, content FROM `sheet` WHERE id = ' .
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
        sql_set(
            'UPDATE `sheet` SET is_current = 0 WHERE user = ' .
                intval($user['id']) .
                ' AND `key` = "' .
                sql_escape($current['key']) .
                '";'
        );
        sql_set(
            'UPDATE `sheet` SET is_current = 1, updated_at = "' .
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
        'content' => $data['content'],
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
