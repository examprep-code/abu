<?php

$classConfig = [
    'classroom' => [
        'id' => [],
        'user' => [],
        'school' => [],
        'name' => [],
        'year' => [],
        'profession' => [],
        'notes' => [],
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
    $classConfig['classroom']['_where'] = $where;
    $result = get($classConfig);
    if (!empty($paras[0])) {
        $return['data'] = $result['classroom'][0] ?? [];
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

    $schoolId = $data['school'] ?? null;
    if ($schoolId) {
        $schoolCheck = sql_get(
            'SELECT id FROM `school` WHERE id = ' .
                intval($schoolId) .
                ' AND user = ' .
                intval($user['id']) .
                ' LIMIT 1;'
        );
        if (!count($schoolCheck)) {
            $return['status'] = 400;
            warning('schule nicht gefunden');
            return;
        }
    }

    $now = date('Y-m-d H:i:s');
    $payload = [
        'user' => ['id' => $user['id']],
        'name' => $name,
        'year' => trim($data['year'] ?? ''),
        'profession' => trim($data['profession'] ?? ''),
        'notes' => trim($data['notes'] ?? ''),
        'created_at' => $now,
        'updated_at' => $now,
    ];
    if ($schoolId) {
        $payload['school'] = ['id' => intval($schoolId)];
    }

    set(
        'classroom',
        [
            'user' => [],
            'school' => [],
            'name' => [],
            'year' => [],
            'profession' => [],
            'notes' => [],
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
        'SELECT id FROM `classroom` WHERE id = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ' LIMIT 1;'
    );
    if (!count($existing)) {
        $return['status'] = 404;
        warning('klasse nicht gefunden');
        return;
    }

    $update = [];
    if (array_key_exists('name', $data)) $update['name'] = trim($data['name']);
    if (array_key_exists('year', $data)) $update['year'] = trim($data['year']);
    if (array_key_exists('profession', $data)) $update['profession'] = trim($data['profession']);
    if (array_key_exists('notes', $data)) $update['notes'] = trim($data['notes']);
    if (array_key_exists('school', $data)) {
        $rawSchool = $data['school'];
        if ($rawSchool === null || $rawSchool === '') {
            $update['school'] = '';
        } else {
            $schoolId = intval($rawSchool);
            $schoolCheck = sql_get(
                'SELECT id FROM `school` WHERE id = ' .
                    $schoolId .
                    ' AND user = ' .
                    intval($user['id']) .
                    ' LIMIT 1;'
            );
            if (!count($schoolCheck)) {
                $return['status'] = 400;
                warning('schule nicht gefunden');
                return;
            }
            $update['school'] = $schoolId;
        }
    }

    $update['updated_at'] = date('Y-m-d H:i:s');

    sql_update('classroom', $update, intval($id));
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
        'SELECT id FROM `classroom` WHERE id = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ' LIMIT 1;'
    );
    if (!count($existing)) {
        $return['status'] = 404;
        warning('klasse nicht gefunden');
        return;
    }

    sql_set(
        'DELETE FROM `learner` WHERE classroom = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ';'
    );
    sql_set(
        'DELETE FROM `classroom_sheet` WHERE classroom = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ';'
    );
    sql_delete('classroom', intval($id));
    return;
}

?>
