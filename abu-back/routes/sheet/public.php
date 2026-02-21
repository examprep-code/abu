<?php

$key = trim($paras[0] ?? ($_GET['key'] ?? ''));
if ($key === '') {
    $return['status'] = 400;
    warning('key fehlt');
    return;
}

$result = sql_get(
    'SELECT id, user, `key`, `name`, content, updated_at, created_at
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

    $classroomMeta = sql_get(
        'SELECT c.id AS classroom, c.school, s.name AS school_name, s.ci_css AS school_css
         FROM `classroom` c
         LEFT JOIN `school` s ON s.id = c.school
         WHERE c.id = ' . $classroomId . '
           AND c.user = ' . intval($result[0]['user']) . '
         LIMIT 1;'
    );
    if (!empty($classroomMeta)) {
        $result[0]['classroom'] = $classroomMeta[0]['classroom'] ?? null;
        $result[0]['school'] = $classroomMeta[0]['school'] ?? null;
        $result[0]['school_name'] = $classroomMeta[0]['school_name'] ?? null;
        $result[0]['school_css'] = $classroomMeta[0]['school_css'] ?? '';
    }
}

$return['data'] = $result[0];
unset($return['data']['user']);
return;

?>
