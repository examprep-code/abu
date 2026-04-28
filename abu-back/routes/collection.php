<?php

$collectionConfig = [
    'collection' => [
        'id' => [],
        'user' => [],
        'name' => [],
        'description' => [],
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
    $where = [];
    $scopeToCurrentUser = !user_is_admin() || !empty($paras[0]);
    if ($scopeToCurrentUser) {
        $where[] = 'user = ' . intval($user['id']);
    }
    if (!empty($paras[0])) {
        $where[] = 'id = ' . intval($paras[0]);
    }
    $collectionConfig['collection']['_where'] = $where;
    $collectionConfig['collection']['_append'] = ['ORDER BY updated_at DESC, name ASC'];
    $result = get($collectionConfig);
    if (!empty($paras[0])) {
        $return['data'] = $result['collection'][0] ?? [];
    } else {
        $return['data'] = $result;
    }
    return;
}

if ($method === 'POST') {
    $name = trim((string) ($data['name'] ?? ''));
    if ($name === '') {
        $return['status'] = 400;
        warning('name fehlt');
        return;
    }

    $now = date('Y-m-d H:i:s');
    $payload = [
        'user' => ['id' => $user['id']],
        'name' => $name,
        'description' => trim((string) ($data['description'] ?? '')),
        'created_at' => $now,
        'updated_at' => $now,
    ];

    set(
        'collection',
        [
            'user' => [],
            'name' => [],
            'description' => [],
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

    $existing = sql_get(
        'SELECT id FROM `collection` WHERE id = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ' LIMIT 1;'
    );
    if (!count($existing)) {
        $return['status'] = 404;
        warning('sammlung nicht gefunden');
        return;
    }

    $update = [];
    if (array_key_exists('name', $data)) {
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            $return['status'] = 400;
            warning('name fehlt');
            return;
        }
        $update['name'] = $name;
    }
    if (array_key_exists('description', $data)) {
        $update['description'] = trim((string) ($data['description'] ?? ''));
    }
    $update['updated_at'] = date('Y-m-d H:i:s');

    sql_update('collection', $update, intval($id));
    return;
}

if ($method === 'DELETE') {
    $id = $data['id'] ?? ($paras[0] ?? null);
    if (!$id) {
        $return['status'] = 400;
        warning('id fehlt');
        return;
    }

    $existing = sql_get(
        'SELECT id FROM `collection` WHERE id = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ' LIMIT 1;'
    );
    if (!count($existing)) {
        $return['status'] = 404;
        warning('sammlung nicht gefunden');
        return;
    }

    sql_set(
        'DELETE FROM `collection_sheet` WHERE collection = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ';'
    );
    sql_delete('collection', intval($id));
    return;
}

$return['status'] = 405;
warning('Methode nicht erlaubt');

?>
