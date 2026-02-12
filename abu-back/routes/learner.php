<?php

$learnerConfig = [
    'learner' => [
        'id' => [],
        'user' => [],
        'classroom' => [],
        'name' => [],
        'email' => [],
        'code' => [],
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
    if (!empty($_GET['classroom'])) {
        $where[] = 'classroom = ' . intval($_GET['classroom']);
    }
    $learnerConfig['learner']['_where'] = $where;
    $result = get($learnerConfig);
    if (!empty($paras[0])) {
        $return['data'] = $result['learner'][0] ?? [];
    } else {
        $return['data'] = $result;
    }
    return;
}

if ($method === 'POST') {
    $name = trim($data['name'] ?? '');
    $classId = $data['classroom'] ?? null;
    if ($name === '') {
        $return['status'] = 400;
        warning('name fehlt');
        return;
    }
    if (!$classId) {
        $return['status'] = 400;
        warning('classroom fehlt');
        return;
    }

    $classCheck = sql_get(
        'SELECT id FROM `classroom` WHERE id = ' .
            intval($classId) .
            ' AND user = ' .
            intval($user['id']) .
            ' LIMIT 1;'
    );
    if (!count($classCheck)) {
        $return['status'] = 404;
        warning('klasse nicht gefunden');
        return;
    }

    $now = date('Y-m-d H:i:s');
    $code = generate_learner_code();
    if (!$code) {
        $return['status'] = 500;
        warning('identifikationscode konnte nicht erstellt werden');
        return;
    }
    $email = trim($data['email'] ?? '');
    $payload = [
        'user' => ['id' => $user['id']],
        'classroom' => ['id' => intval($classId)],
        'name' => $name,
        'code' => $code,
        'notes' => trim($data['notes'] ?? ''),
        'created_at' => $now,
        'updated_at' => $now,
    ];
    if ($email !== '') {
        $payload['email'] = strtolower($email);
    }

    set(
        'learner',
        [
            'user' => [],
            'classroom' => [],
            'name' => [],
            'email' => [],
            'code' => [],
            'notes' => [],
            'created_at' => [],
            'updated_at' => [],
        ],
        [$payload],
        'POST'
    );
    $return['data']['code'] = $code;
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
        'SELECT id FROM `learner` WHERE id = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ' LIMIT 1;'
    );
    if (!count($existing)) {
        $return['status'] = 404;
        warning('lernende nicht gefunden');
        return;
    }

    $update = [];
    if (array_key_exists('name', $data)) $update['name'] = trim($data['name']);
    if (array_key_exists('email', $data)) {
        $email = trim($data['email']);
        if ($email === '') {
            $update['email'] = null;
        } else {
            $email = strtolower($email);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                warning('email ist ungueltig');
            }
            $update['email'] = $email;
        }
    }
    if (array_key_exists('notes', $data)) $update['notes'] = trim($data['notes']);

    if (array_key_exists('classroom', $data)) {
        $classId = intval($data['classroom']);
        $classCheck = sql_get(
            'SELECT id FROM `classroom` WHERE id = ' .
                $classId .
                ' AND user = ' .
                intval($user['id']) .
                ' LIMIT 1;'
        );
        if (!count($classCheck)) {
            $return['status'] = 404;
            warning('klasse nicht gefunden');
            return;
        }
        $update['classroom'] = $classId;
    }

    $update['updated_at'] = date('Y-m-d H:i:s');
    sql_update('learner', $update, intval($id));
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
        'SELECT id FROM `learner` WHERE id = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ' LIMIT 1;'
    );
    if (!count($existing)) {
        $return['status'] = 404;
        warning('lernende nicht gefunden');
        return;
    }

    sql_delete('learner', intval($id));
    return;
}

function generate_learner_code()
{
    $maxTries = 20;
    $chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    $charLen = strlen($chars) - 1;
    for ($i = 0; $i < $maxTries; $i++) {
        $code = '';
        try {
            for ($j = 0; $j < 12; $j++) {
                $code .= $chars[random_int(0, $charLen)];
            }
        } catch (Exception $e) {
            for ($j = 0; $j < 12; $j++) {
                $code .= $chars[rand(0, $charLen)];
            }
        }

        $existing = sql_get(
            'SELECT id FROM `learner` WHERE code = "' . sql_escape($code) . '" LIMIT 1;'
        );
        if (!count($existing)) {
            return $code;
        }
    }

    return null;
}

?>
