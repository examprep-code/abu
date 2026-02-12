<?php

$planConfig = [
    'classroom_sheet' => [
        'id' => [],
        'user' => [],
        'classroom' => [],
        'sheet_key' => [],
        'status' => [],
        'created_at' => [],
        'updated_at' => [],
    ],
];

const PLAN_STATUSES = ['aktiv', 'freiwillig', 'archiviert'];

function normalize_plan_status($value) {
    $status = strtolower(trim((string) $value));
    if ($status === '') return '';
    if (!in_array($status, PLAN_STATUSES, true)) return '';
    return $status;
}

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
    if (!empty($_GET['sheet_key'])) {
        $where[] = '`sheet_key` = "' . sql_escape(trim($_GET['sheet_key'])) . '"';
    }
    $planConfig['classroom_sheet']['_where'] = $where;
    $result = get($planConfig);
    if (!empty($paras[0])) {
        $return['data'] = $result['classroom_sheet'][0] ?? [];
    } else {
        $return['data'] = $result;
    }
    return;
}

if ($method === 'POST') {
    $classId = $data['classroom'] ?? null;
    $sheetKey = trim($data['sheet_key'] ?? ($data['sheet'] ?? ''));
    $status = normalize_plan_status($data['status'] ?? 'aktiv');
    if (!$classId) {
        $return['status'] = 400;
        warning('classroom fehlt');
        return;
    }
    if ($sheetKey === '') {
        $return['status'] = 400;
        warning('sheet_key fehlt');
        return;
    }
    if ($status === '') {
        $return['status'] = 400;
        warning('status ungueltig');
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

    $sheetCheck = sql_get(
        'SELECT id FROM `sheet` WHERE user = ' .
            intval($user['id']) .
            ' AND `key` = "' .
            sql_escape($sheetKey) .
            '" LIMIT 1;'
    );
    if (!count($sheetCheck)) {
        $return['status'] = 404;
        warning('sheet nicht gefunden');
        return;
    }

    $existing = sql_get(
        'SELECT id FROM `classroom_sheet` WHERE user = ' .
            intval($user['id']) .
            ' AND classroom = ' .
            intval($classId) .
            ' AND sheet_key = "' .
            sql_escape($sheetKey) .
            '" LIMIT 1;'
    );
    if (!empty($existing)) {
        sql_update(
            'classroom_sheet',
            ['status' => $status, 'updated_at' => date('Y-m-d H:i:s')],
            intval($existing[0]['id'])
        );
        $return['data'] = ['id' => $existing[0]['id']];
        return;
    }

    $now = date('Y-m-d H:i:s');
    $payload = [
        'user' => ['id' => $user['id']],
        'classroom' => ['id' => intval($classId)],
        'sheet_key' => $sheetKey,
        'status' => $status,
        'created_at' => $now,
        'updated_at' => $now,
    ];

    set(
        'classroom_sheet',
        [
            'user' => [],
            'classroom' => [],
            'sheet_key' => [],
            'status' => [],
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
    $status = normalize_plan_status($data['status'] ?? '');
    if (!$id) {
        $return['status'] = 400;
        warning('id fehlt');
        return;
    }
    if ($status === '') {
        $return['status'] = 400;
        warning('status ungueltig');
        return;
    }

    $existing = sql_get(
        'SELECT id FROM `classroom_sheet` WHERE id = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ' LIMIT 1;'
    );
    if (!count($existing)) {
        $return['status'] = 404;
        warning('zuordnung nicht gefunden');
        return;
    }

    sql_update(
        'classroom_sheet',
        ['status' => $status, 'updated_at' => date('Y-m-d H:i:s')],
        intval($id)
    );
    return;
}

if ($method === 'DELETE') {
    $id = $data['id'] ?? ($paras[0] ?? null);
    $classId = $data['classroom'] ?? null;
    $sheetKey = trim($data['sheet_key'] ?? ($data['sheet'] ?? ''));

    if (!$id && (!$classId || $sheetKey === '')) {
        $return['status'] = 400;
        warning('id fehlt');
        return;
    }

    if ($id) {
        $existing = sql_get(
            'SELECT id FROM `classroom_sheet` WHERE id = ' .
                intval($id) .
                ' AND user = ' .
                intval($user['id']) .
                ' LIMIT 1;'
        );
    } else {
        $existing = sql_get(
            'SELECT id FROM `classroom_sheet` WHERE user = ' .
                intval($user['id']) .
                ' AND classroom = ' .
                intval($classId) .
                ' AND sheet_key = "' .
                sql_escape($sheetKey) .
                '" LIMIT 1;'
        );
    }

    if (!count($existing)) {
        $return['status'] = 404;
        warning('zuordnung nicht gefunden');
        return;
    }

    sql_delete('classroom_sheet', intval($existing[0]['id']));
    return;
}

$return['status'] = 405;
warning('Methode nicht erlaubt');

?>
