<?php

$key = trim($paras[0] ?? ($_GET['key'] ?? ''));
if ($key === '') {
    $return['status'] = 400;
    warning('key fehlt');
    return;
}

$result = sql_get(
    'SELECT id, `key`, `name`, content, updated_at, created_at
     FROM `sheet`
     WHERE `key` = "' . sql_escape($key) . '" AND is_current = 1
     ORDER BY updated_at DESC
     LIMIT 1;'
);

if (!count($result)) {
    $return['status'] = 404;
    warning('sheet nicht gefunden');
    return;
}

$classroomId = intval($_GET['classroom'] ?? 0);
if ($classroomId > 0) {
    $assignment = sql_get(
        'SELECT status, assignment_form
         FROM `classroom_sheet`
         WHERE classroom = ' . $classroomId . '
           AND sheet_key = "' . sql_escape($key) . '"
         LIMIT 1;'
    );
    if (!empty($assignment)) {
        $result[0]['assignment_status'] = $assignment[0]['status'] ?? null;
        $result[0]['assignment_form'] = $assignment[0]['assignment_form'] ?? null;
    }
}

$return['data'] = $result[0];
return;

?>
