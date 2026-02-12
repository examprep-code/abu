<?php
$m['classroom']=[
    'id' => ['id'],
    'user' => ['fkey', 'table'=>'user', 'key'=>'id'],
    'school' => ['fkey', 'table'=>'school', 'key'=>'id'],
    'name' => ['word'],
    'year' => ['word'],
    'profession' => ['word'],
    'notes' => ['text'],
    'created_at' => ['timestamp'],
    'updated_at' => ['timestamp'],
    'learners' => ['rkey', 'table'=>'learner', 'key'=>'classroom'],
];
?>
