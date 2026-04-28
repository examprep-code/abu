#!/usr/bin/env php
<?php

require_once __DIR__ . '/../env.php';
require_once __DIR__ . '/../datian-core/helper.php';

$return = [
    'message' => '',
    'warning' => '',
    'debug' => [],
    'data' => [],
    'log' => [],
];

$apply = in_array('--apply', $argv, true);
$dryRun = !$apply;

$countRow = sql_get("SELECT COUNT(*) AS cnt FROM `sheet` WHERE content LIKE '%luecke-gap-wide%';");
$count = isset($countRow[0]['cnt']) ? intval($countRow[0]['cnt']) : 0;

echo "Found {$count} sheet row(s) containing <luecke-gap-wide>.\n";
echo "Mode: " . ($dryRun ? "dry-run" : "apply") . "\n";

if ($dryRun) {
    echo "Run with --apply to update DB.\n";
    exit(0);
}

sql_set(
    'UPDATE `sheet` ' .
        'SET content = REPLACE(' .
            'REPLACE(content, \'<luecke-gap-wide\', \'<luecke-gap width="100%"\'), ' .
            '\'</luecke-gap-wide>\', \'</luecke-gap>\'' .
        ') ' .
        "WHERE content LIKE '%luecke-gap-wide%';"
);

$affectedRow = sql_get('SELECT ROW_COUNT() AS affected;');
$affected = isset($affectedRow[0]['affected']) ? intval($affectedRow[0]['affected']) : 0;
echo "Updated {$affected} row(s).\n";

?>
