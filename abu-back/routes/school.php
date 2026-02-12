<?php

$schoolConfig = [
    'school' => [
        'id' => [],
        'user' => [],
        'name' => [],
        'ci_css' => [],
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
    if (!empty($paras[0])) {
        $where[] = 'id = ' . intval($paras[0]);
    }
    $schoolConfig['school']['_where'] = $where;
    $result = get($schoolConfig);
    if (!empty($paras[0])) {
        $return['data'] = $result['school'][0] ?? [];
    } else {
        $return['data'] = $result;
    }
    return;
}

if ($method === 'POST') {
    $name = trim($data['name'] ?? '');
    if ($name === '') {
        $return['status'] = 400;
        warning('name fehlt');
        return;
    }

    $now = date('Y-m-d H:i:s');
    $payload = [
        'user' => ['id' => $user['id']],
        'name' => $name,
        'ci_css' => (string) ($data['ci_css'] ?? ''),
        'created_at' => $now,
        'updated_at' => $now,
    ];

    set(
        'school',
        [
            'user' => [],
            'name' => [],
            'ci_css' => [],
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
        'SELECT id FROM `school` WHERE id = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ' LIMIT 1;'
    );
    if (!count($existing)) {
        $return['status'] = 404;
        warning('schule nicht gefunden');
        return;
    }

    $update = [];
    if (array_key_exists('name', $data)) $update['name'] = trim($data['name']);
    if (array_key_exists('ci_css', $data)) $update['ci_css'] = (string) ($data['ci_css'] ?? '');
    $update['updated_at'] = date('Y-m-d H:i:s');

    sql_update('school', $update, intval($id));
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
        'SELECT id FROM `school` WHERE id = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ' LIMIT 1;'
    );
    if (!count($existing)) {
        $return['status'] = 404;
        warning('schule nicht gefunden');
        return;
    }

    sql_set(
        'UPDATE `classroom` SET school = null WHERE school = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ';'
    );
    sql_delete('school', intval($id));
    return;
}

?>
