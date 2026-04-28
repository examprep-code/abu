<?php

foreach (glob("model/*.php") as $filename)
{
    include_once $filename;
}

function migration_table_exists(): bool
{
    $result = sql_get("SHOW TABLES LIKE 'migration';");
    return !empty($result);
}

function ensure_migration_table(): void
{
    if (migration_table_exists()) return;
    sql_set(
        'CREATE TABLE IF NOT EXISTS `migration`(' .
            'id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ' .
            'table_name VARCHAR(255), ' .
            'field_name VARCHAR(255), ' .
            'field_type VARCHAR(255)' .
            ');'
    );
}

function table_exists(string $table): bool
{
    $tableEsc = sql_escape($table);
    $result = sql_get("SHOW TABLES LIKE '" . $tableEsc . "';");
    return !empty($result);
}

function ensure_table_exists(string $table): void
{
    if (table_exists($table)) return;
    // Minimal base table; columns will be added by alter_sql().
    sql_set(
        'CREATE TABLE IF NOT EXISTS `' .
            sql_escape($table) .
            '`(id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY);'
    );
}

function get_table_columns(string $table): array
{
    if (!table_exists($table)) return [];
    // SHOW COLUMNS returns: Field, Type, Null, Key, Default, Extra
    return sql_get('SHOW COLUMNS FROM `' . sql_escape($table) . '`;');
}

function init_sql()
{
    global $m;
    // Safe initialization: ensure schema metadata table exists and base tables exist.
    // This MUST NOT drop existing tables/data.
    ensure_migration_table();
    foreach ($m as $table=>$values) {
        ensure_table_exists($table);
    }
}

function alter_sql()
{
    global $m;
    ensure_migration_table();

    foreach ($m as $table=>$columns) {
        ensure_table_exists($table);

        $existingColumns = get_table_columns($table);
        $existingMap = [];
        foreach ($existingColumns as $col) {
            if (isset($col['Field'])) {
                $existingMap[$col['Field']] = $col;
            }
        }

        $tableEsc = sql_escape($table);
        $migrations = sql_get('SELECT * FROM `migration` WHERE table_name="' . $tableEsc . '";');
        $migrationMap = [];
        foreach ($migrations as $mig) {
            if (isset($mig['field_name'])) {
                $migrationMap[$mig['field_name']] = $mig;
            }
        }

        foreach ($columns as $name=>$type) {
            $modelType = $type[0] ?? '';
            $sqlType = sql_type($modelType);
            if (!$sqlType) continue;

            $columnExists = array_key_exists($name, $existingMap);
            $migration = $migrationMap[$name] ?? null;

            if ($columnExists) {
                if (empty($migration)) {
                    sql_set(
                        'INSERT INTO `migration` (table_name, field_name, field_type) VALUES ("' .
                            $tableEsc .
                            '", "' .
                            sql_escape($name) .
                            '", "' .
                            sql_escape($sqlType) .
                            '");'
                    );
                } elseif (($migration['field_type'] ?? '') !== $sqlType) {
                    sql_set(
                        'ALTER TABLE `' .
                            $tableEsc .
                            '` MODIFY COLUMN `' .
                            sql_escape($name) .
                            '` ' .
                            $sqlType .
                            ';'
                    );
                    sql_set(
                        'UPDATE `migration` SET field_type = "' .
                            sql_escape($sqlType) .
                            '" WHERE id = ' .
                            intval($migration['id']) .
                            ';'
                    );
                }
                continue;
            }

            sql_set(
                'ALTER TABLE `' .
                    $tableEsc .
                    '` ADD COLUMN `' .
                    sql_escape($name) .
                    '` ' .
                    $sqlType .
                    ';'
            );
            sql_set(
                'INSERT INTO `migration` (table_name, field_name, field_type) VALUES ("' .
                    $tableEsc .
                    '", "' .
                    sql_escape($name) .
                    '", "' .
                    sql_escape($sqlType) .
                    '");'
            );
        }
    }
}

function sql_type($type){
    global $m2s;
    global $s;
    return ($s[$m2s[$type]]) ?? false;
}

function reset_table($table){
    sql_set('DROP TABLE IF EXISTS `'.$table.'`;');
    sql_set('CREATE TABLE `'.$table.'`(id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY);');
}

?>
