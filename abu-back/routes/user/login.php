<?php
// Login via email/password or token check.
$tokenCounterModule = dirname(__DIR__, 2) . '/snippets/agent/token_counter.php';
if (is_readable($tokenCounterModule)) {
    include_once $tokenCounterModule;
}

$token = null;
if (is_array($data) && isset($data['token'])) {
    $token = $data['token'];
} elseif (isset($_GET['token'])) {
    $token = $_GET['token'];
} elseif (!empty($paras[0])) {
    $token = $paras[0];
}

if ($token) {
    $token = sql_escape($token);
    $users = sql_get(
        'SELECT * FROM `user` WHERE token = "' .
            $token .
            '" AND valid_until>=NOW() LIMIT 1;'
    );
    if (count($users)) {
        $stats = function_exists('ai_token_counter_get_user_stats')
            ? ai_token_counter_get_user_stats(intval($users[0]['id']))
            : null;
        $return['data']['user'] = [
            'id' => $users[0]['id'],
            'email' => $users[0]['email'],
            'role' => isset($users[0]['role']) && $users[0]['role'] !== '' ? intval($users[0]['role']) : 1,
        ];
        if (is_array($stats)) {
            $return['data']['user']['ai_usage'] = $stats;
            $return['data']['ai_usage'] = $stats;
        }
        $return['data']['valid'] = true;
    } else {
        $return['status'] = 401;
        warning('token ungültig');
        $return['data']['user'] = [];
        $return['data']['valid'] = false;
    }
    return;
}

if ($method !== 'POST') {
    $return['status'] = 405;
    warning('Methode nicht erlaubt');
    return;
}

$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

if ($email === '' || $password === '') {
    $return['status'] = 400;
    warning('email und password sind erforderlich');
    return;
}

$email = strtolower($email);
$emailEsc = sql_escape($email);
$users = sql_get('SELECT * FROM `user` WHERE email = "' . $emailEsc . '" LIMIT 1;');

if (!count($users)) {
    $return['status'] = 401;
    warning('login fehlgeschlagen');
    return;
}

$userRow = $users[0];
if (!password_verify($password, $userRow['password'] ?? '')) {
    $return['status'] = 401;
    warning('login fehlgeschlagen');
    return;
}

try {
    $newToken = bin2hex(random_bytes(32));
} catch (Exception $e) {
    $newToken = random(64);
}

$now = date('Y-m-d H:i:s');
$validUntil = date('Y-m-d H:i:s', time() + 60 * 60 * 24 * 30);

sql_update(
    'user',
    [
        'token' => $newToken,
        'valid_until' => $validUntil,
        'updated_at' => $now,
    ],
    $userRow['id']
);

$return['data'] = [
    'user' => [
        'id' => $userRow['id'],
        'email' => $userRow['email'],
        'role' => isset($userRow['role']) && $userRow['role'] !== '' ? intval($userRow['role']) : 1,
    ],
    'token' => $newToken,
    'valid_until' => $validUntil,
    'valid' => true,
];
$stats = function_exists('ai_token_counter_get_user_stats')
    ? ai_token_counter_get_user_stats(intval($userRow['id']))
    : null;
if (is_array($stats)) {
    $return['data']['user']['ai_usage'] = $stats;
    $return['data']['ai_usage'] = $stats;
}
?>
