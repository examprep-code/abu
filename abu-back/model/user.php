<?php
$m['user']=[
    'id' => ['id'],
    'email' => ['email'],
    'password' => ['password'],
    'token' => ['token'],
    'valid_until' => ['timestamp'],
    'created_at' => ['timestamp'],
    'updated_at' => ['timestamp'],
    'sheets' => ['rkey', 'table'=>'sheet', 'key'=>'user'],
];
?>
