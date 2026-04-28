<?php
$m['user']=[
    'id' => ['id'],
    'role' => ['int'],
    'email' => ['email'],
    'password' => ['password'],
    'token' => ['token'],
    'valid_until' => ['timestamp'],
    'ai_request_count' => ['int'],
    'ai_prompt_tokens' => ['int'],
    'ai_completion_tokens' => ['int'],
    'ai_total_tokens' => ['int'],
    'ai_prompt_cost_usd' => ['float'],
    'ai_completion_cost_usd' => ['float'],
    'ai_total_cost_usd' => ['float'],
    'created_at' => ['timestamp'],
    'updated_at' => ['timestamp'],
    'sheets' => ['rkey', 'table'=>'sheet', 'key'=>'user'],
    'schools' => ['rkey', 'table'=>'school', 'key'=>'user'],
    'classes' => ['rkey', 'table'=>'classroom', 'key'=>'user'],
    'learners' => ['rkey', 'table'=>'learner', 'key'=>'user'],
];
?>
