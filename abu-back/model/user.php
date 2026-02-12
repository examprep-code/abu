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
    'schools' => ['rkey', 'table'=>'school', 'key'=>'user'],
    'classes' => ['rkey', 'table'=>'classroom', 'key'=>'user'],
    'learners' => ['rkey', 'table'=>'learner', 'key'=>'user'],
];
?>
