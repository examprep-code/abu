<?php

// Oeffentliche Liste aktueller Sheets (ohne Auth).
// Optional gefiltert ueber Lernenden-Code.

function build_sheet_summary($content)
{
    $text = trim(preg_replace('/\s+/', ' ', strip_tags((string) $content)));
    if ($text === '') return '';
    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        if (mb_strlen($text) <= 180) return $text;
        return mb_substr($text, 0, 177) . '...';
    }
    if (strlen($text) <= 180) return $text;
    return substr($text, 0, 177) . '...';
}

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
        'SELECT DISTINCT s.`key`, s.`name`, s.content, s.updated_at, s.created_at,
            cs.status AS assignment_status, cs.assignment_form
         FROM `sheet` s
         INNER JOIN `classroom_sheet` cs
            ON cs.sheet_key = s.`key`
            AND cs.classroom = ' . intval($learner['classroom']) . '
            AND cs.user = ' . intval($learner['user']) . '
            AND cs.status IN ("aktiv", "freiwillig", "archiviert")
         WHERE s.is_current = 1
           AND s.user = ' . intval($learner['user']) . '
         ORDER BY
            CASE
                WHEN cs.status = "aktiv" THEN 1
                WHEN cs.status = "freiwillig" THEN 2
                WHEN cs.status = "archiviert" THEN 3
                ELSE 4
            END,
            s.updated_at DESC;'
    );
    foreach ($rows as &$row) {
        $row['summary'] = build_sheet_summary($row['content'] ?? '');
        unset($row['content']);
    }
    unset($row);

    $return['data'] = ['sheet' => $rows];
    return;
}

$rows = sql_get(
    'SELECT `key`, `name`, content, updated_at, created_at
     FROM `sheet`
     WHERE is_current = 1
     ORDER BY updated_at DESC;'
);
foreach ($rows as &$row) {
    $row['summary'] = build_sheet_summary($row['content'] ?? '');
    unset($row['content']);
}
unset($row);

$return['data'] = ['sheet' => $rows];
return;

?>
