<?php

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
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $return['status'] = 400;
    warning('email ist ungültig');
    return;
}
$emailEsc = sql_escape($email);

$exists = sql_get('SELECT id FROM `user` WHERE email = "' . $emailEsc . '" LIMIT 1;');
if (!empty($exists)) {
    $return['status'] = 409;
    warning('email bereits vergeben');
    return;
}

$now = date('Y-m-d H:i:s');
$roleColumn = sql_get('SHOW COLUMNS FROM `user` LIKE "role";');
$hasRole = !empty($roleColumn);
$payload = [
    'email' => $email,
    'password' => $password,
    'created_at' => $now,
    'updated_at' => $now,
];
if ($hasRole) {
    $payload['role'] = 0;
}

$setConfig = [
    'email' => [],
    'password' => [],
    'created_at' => [],
    'updated_at' => [],
];
if ($hasRole) {
    $setConfig['role'] = [];
}

set('user', $setConfig, [$payload], 'POST');

$userId = $return['data']['id'] ?? null;
$return['data'] = [
    'user' => [
        'id' => $userId,
        'email' => $email,
        'role' => $hasRole ? 0 : 1,
    ],
];
?>
