<?php
$m['school']=[
    'id' => ['id'],
    'user' => ['fkey', 'table'=>'user', 'key'=>'id'],
    'name' => ['word'],
    'ci_css' => ['text'],
    'created_at' => ['timestamp'],
    'updated_at' => ['timestamp'],
    'classes' => ['rkey', 'table'=>'classroom', 'key'=>'school'],
];
?>
