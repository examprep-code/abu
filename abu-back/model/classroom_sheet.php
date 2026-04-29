<?php
$m['classroom_sheet']=[
    'id' => ['id'],
    'user' => ['fkey', 'table'=>'user', 'key'=>'id'],
    'classroom' => ['fkey', 'table'=>'classroom', 'key'=>'id'],
    'sheet_key' => ['word'],
    'assignment_form' => ['word'],
    'status' => ['word'],
    'prompt' => ['text'],
    'created_at' => ['timestamp'],
    'updated_at' => ['timestamp'],
];
?>
