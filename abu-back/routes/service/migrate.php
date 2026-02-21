<?php
require_once 'datian-core/migration.php';

// First deployment: initialize schema metadata table and base tables if missing.
$migrationTable = sql_get("SHOW TABLES LIKE 'migration';");
if (empty($migrationTable)) {
    init_sql();
}

alter_sql();



?>
