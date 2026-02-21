<?php
// Login fuer Lernende ueber 12-stelligen Identifikationscode.

$code = null;
if (is_array($data) && isset($data['code'])) {
    $code = $data['code'];
} elseif (isset($_GET['code'])) {
    $code = $_GET['code'];
} elseif (!empty($paras[0])) {
    $code = $paras[0];
}

$code = trim((string) $code);
if ($code === '') {
    $return['status'] = 400;
    warning('code fehlt');
    return;
}

$rows = sql_get(
    'SELECT
        l.id,
        l.name,
        l.code,
        l.classroom,
        c.school,
        s.name AS school_name,
        s.ci_css AS school_css
     FROM `learner` l
     LEFT JOIN `classroom` c ON c.id = l.classroom
     LEFT JOIN `school` s ON s.id = c.school
     WHERE l.code = "' . sql_escape($code) . '"
     LIMIT 1;'
);

$learner = $rows[0] ?? null;

if (!empty($learner)) {
    $learner['classroom'] = isset($learner['classroom']) ? intval($learner['classroom']) : null;
    $learner['school'] = isset($learner['school']) ? intval($learner['school']) : null;
    $learner['school_name'] = $learner['school_name'] ?? null;
    $learner['school_css'] = (string) ($learner['school_css'] ?? '');
    $return['data']['learner'] = $learner;
    $return['data']['valid'] = true;
} else {
    $return['status'] = 401;
    warning('code ungültig');
    $return['data']['learner'] = [];
    $return['data']['valid'] = false;
}
?>
