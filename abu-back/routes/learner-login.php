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

$learnerConfig = [
    'learner' => [
        'id' => [],
        'name' => [],
        'code' => [],
        'classroom' => [
            'id' => [],
            'school' => [
                'id' => [],
                'name' => [],
                'ci_css' => [],
            ],
        ],
        '_snippets' => ['transform/learner_login' => true],
    ],
];

$learnerConfig['learner']['_where'] = [
    'code = "' . sql_escape($code) . '"',
];

$result = get($learnerConfig);
$learner = $result['learner'][0] ?? null;

if (!empty($learner)) {
    $return['data']['learner'] = $learner;
    $return['data']['valid'] = true;
} else {
    $return['status'] = 401;
    warning('code ungültig');
    $return['data']['learner'] = [];
    $return['data']['valid'] = false;
}
?>
