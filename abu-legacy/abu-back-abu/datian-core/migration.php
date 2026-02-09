<?php

foreach (glob("model/*.php") as $filename)
{
    include_once $filename;
}

function init_sql()
{
    global $m;
    sql_set('DROP TABLE IF EXISTS `migration`;');
    sql_set('CREATE TABLE `migration`(id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, table_name VARCHAR(255), field_name VARCHAR(255), field_type VARCHAR(255));');

    foreach ($m as $table=>$values)
    {
        reset_table($table);
    }
}

function alter_sql()
{
    global $m;
    
    foreach ($m as $table=>$columns) //foreach table in model $m
    {
        //get all migration entries for this table
        $column_string='';
        $migrations=sql_get('SELECT * FROM `migration` WHERE table_name="'.$table.'";');
        inf($migrations, $table);

        //if no entry is found: create that table
        if (empty($migrations)){
            reset_table($table);
        }

        //foreach entry in the current table
        foreach ($columns as $name=>$type){
            //get the type
            $type=$type[0] ?? '';
            $buffer=sql_type($type);
            inf($buffer, $name);

            //search for column entry in migration table
            $migration=subarray_search($name, $migrations, 'field_name');
            if (!empty($migration))
            {
                if (!empty($buffer))
                {
                    //if migration is set and type is not empty: modify column
                    if ($migration['field_type']!==$buffer){
                        sql_set ('ALTER TABLE `'.$table.'` MODIFY COLUMN '.$name.' '.$buffer.';');
                        sql_set ('UPDATE `migration` SET field_type = "'.$buffer.'" WHERE id = '.$migration['id'].';');
                    }
                }
                else //if migration is set but model is empty drop the column
                {
                    sql_set ('ALTER TABLE `'.$table.'` DROP COLUMN '.$name.';');
                }
            }
            else{ //if migration is empty: create the column
                if ($buffer){
                    sql_set ('ALTER TABLE `'.$table.'` ADD `'.$name.'` '.$buffer.';');
                    sql_set ('INSERT INTO `migration` (table_name, field_name, field_type) VALUES ("'.$table.'", "'.$name.'", "'.$buffer.'");');
                }
            }
        }
    }
}

function sql_type($type){
    global $m2s;
    global $s;
    inf([$s, $m2s, $type]);
    return ($s[$m2s[$type]]) ?? false;
}

function reset_table($table){
    sql_set('DROP TABLE IF EXISTS `'.$table.'`;');
    sql_set('CREATE TABLE `'.$table.'`(id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY);');
}

?>
