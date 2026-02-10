<?php
// Login via email/password or token check.

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
        'SELECT id, email, valid_until FROM `user` WHERE token = "' .
            $token .
            '" AND valid_until>=NOW() LIMIT 1;'
    );
    if (count($users)) {
        $return['data']['user'] = [
            'id' => $users[0]['id'],
            'email' => $users[0]['email'],
        ];
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
    ],
    'token' => $newToken,
    'valid_until' => $validUntil,
    'valid' => true,
];
?>
