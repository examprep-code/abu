<?php
$m['collection_sheet']=[
    'id' => ['id'],
    'user' => ['fkey', 'table'=>'user', 'key'=>'id'],
    'collection' => ['fkey', 'table'=>'collection', 'key'=>'id'],
    'sheet_key' => ['word'],
    'position' => ['position'],
    'created_at' => ['timestamp'],
    'updated_at' => ['timestamp'],
];
?>
