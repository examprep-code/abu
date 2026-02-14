<?php

$planConfig = [
    'classroom_sheet' => [
        'id' => [],
        'user' => [],
        'classroom' => [],
        'sheet_key' => [],
        'assignment_form' => [],
        'status' => [],
        'created_at' => [],
        'updated_at' => [],
    ],
];

const PLAN_STATUSES = ['aktiv', 'freiwillig', 'archiviert'];
const PLAN_FORMS = ['personal', 'anonym'];

function normalize_plan_status($value) {
    $status = strtolower(trim((string) $value));
    if ($status === '') return '';
    if (!in_array($status, PLAN_STATUSES, true)) return '';
    return $status;
}

function normalize_plan_form($value) {
    $form = strtolower(trim((string) $value));
    if ($form === '') return '';
    if (!in_array($form, PLAN_FORMS, true)) return '';
    return $form;
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
    $formRaw = $data['assignment_form'] ?? ($data['form'] ?? '');
    $assignmentForm = $formRaw !== '' ? normalize_plan_form($formRaw) : 'personal';
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
    if ($assignmentForm === '') {
        $return['status'] = 400;
        warning('form ungueltig');
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
            [
                'status' => $status,
                'assignment_form' => $assignmentForm,
                'updated_at' => date('Y-m-d H:i:s')
            ],
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
        'assignment_form' => $assignmentForm,
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
            'assignment_form' => [],
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
    if (!$id) {
        $return['status'] = 400;
        warning('id fehlt');
        return;
    }
    $status = null;
    if (array_key_exists('status', $data)) {
        $status = normalize_plan_status($data['status'] ?? '');
        if ($status === '') {
            $return['status'] = 400;
            warning('status ungueltig');
            return;
        }
    }

    $assignmentForm = null;
    if (array_key_exists('assignment_form', $data) || array_key_exists('form', $data)) {
        $assignmentForm = normalize_plan_form($data['assignment_form'] ?? ($data['form'] ?? ''));
        if ($assignmentForm === '') {
            $return['status'] = 400;
            warning('form ungueltig');
            return;
        }
    }

    if ($status === null && $assignmentForm === null) {
        $return['status'] = 400;
        warning('keine aenderung uebermittelt');
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

    $update = ['updated_at' => date('Y-m-d H:i:s')];
    if ($status !== null) {
        $update['status'] = $status;
    }
    if ($assignmentForm !== null) {
        $update['assignment_form'] = $assignmentForm;
    }

    sql_update('classroom_sheet', $update, intval($id));
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
