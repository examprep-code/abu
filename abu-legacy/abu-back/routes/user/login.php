<?php
// Token-based login (first version).
// Accepts token via JSON body: { "token": "..." }, query: ?token=..., or path: /user/login//TOKEN

$token = null;
if (is_array($data) && isset($data['token'])) {
    $token = $data['token'];
} elseif (isset($_GET['token'])) {
    $token = $_GET['token'];
} elseif (!empty($paras[0])) {
    $token = $paras[0];
}

if (!$token) {
    $return['status'] = 400;
    warning('token fehlt');
    $return['data']['user'] = [];
    return;
}

$token = sql_escape($token);

$users = get([
    'user' => [
        '_where' => ['secret="' . $token . '"'],
        'name' => [],
    ],
])['user'];

if (count($users)) {
    $return['data']['user'] = [
        'id' => $users[0]['id'],
        'name' => $users[0]['name'],
    ];
    $return['data']['valid'] = true;
} else {
    $return['status'] = 401;
    warning('token ungültig');
    $return['data']['user'] = [];
    $return['data']['valid'] = false;
}
