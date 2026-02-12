<?php

// Oeffentliche Liste aktueller Sheets (ohne Auth).
// Optional gefiltert ueber Lernenden-Code -> nur "aktiv" oder "freiwillig".

$code = trim($_GET['code'] ?? '');
if ($code !== '') {
    $learner = sql_get(
        'SELECT id, user, classroom FROM `learner` WHERE code = "' .
            sql_escape($code) .
            '" LIMIT 1;'
    );
    if (!count($learner)) {
        $return['status'] = 401;
        warning('code ungueltig');
        $return['data'] = ['sheet' => []];
        return;
    }
    $learner = $learner[0];

    $rows = sql_get(
        'SELECT DISTINCT s.`key`, s.`name`, s.updated_at, s.created_at
         FROM `sheet` s
         INNER JOIN `classroom_sheet` cs
            ON cs.sheet_key = s.`key`
            AND cs.classroom = ' . intval($learner['classroom']) . '
            AND cs.user = ' . intval($learner['user']) . '
            AND cs.status IN ("aktiv", "freiwillig")
         WHERE s.is_current = 1
           AND s.user = ' . intval($learner['user']) . '
         ORDER BY s.updated_at DESC;'
    );

    $return['data'] = ['sheet' => $rows];
    return;
}

$rows = sql_get(
    'SELECT `key`, `name`, updated_at, created_at
     FROM `sheet`
     WHERE is_current = 1
     ORDER BY updated_at DESC;'
);

$return['data'] = ['sheet' => $rows];
return;

?>
