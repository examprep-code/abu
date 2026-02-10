<?php
$m['sheet']=[
    'id' => ['id'],
    'user' => ['fkey', 'table'=>'user', 'key'=>'id'],
    'key' => ['word'],
    'name' => ['word'],
    'content' => ['text'],
    'is_current' => ['bool'],
    'created_at' => ['timestamp'],
    'updated_at' => ['timestamp'],
];
?>
