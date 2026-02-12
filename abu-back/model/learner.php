<?php
$m['learner']=[
    'id' => ['id'],
    'user' => ['fkey', 'table'=>'user', 'key'=>'id'],
    'classroom' => ['fkey', 'table'=>'classroom', 'key'=>'id'],
    'name' => ['word'],
    'email' => ['email'],
    'code' => ['token'],
    'notes' => ['text'],
    'created_at' => ['timestamp'],
    'updated_at' => ['timestamp'],
];
?>
