<?php

$m['agent_chat_log'] = [
    'id' => ['id'],
    'user' => ['int'],
    'prompt' => ['longtext'],
    'agent_flow' => ['longtext'],
    'response' => ['longtext'],
    'status' => ['word'],
    'context' => ['longtext'],
    'source' => ['word'],
    'action' => ['word'],
    'outcome' => ['word'],
    'is_error' => ['bool'],
    'model_intent' => ['longtext'],
    'navigation' => ['longtext'],
    'agent_result' => ['longtext'],
    'rating' => ['int'],
    'rating_comment' => ['longtext'],
    'rated_at' => ['timestamp'],
    'created_at' => ['timestamp'],
    'updated_at' => ['timestamp'],
];

?>
