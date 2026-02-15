<?php
$m2s=[
    'id'=>'none',
    'int'=>'int',
    'position'=>'int',
    'word'=>'varchar',
    'bool'=>'bool',
    'enum'=>'int',
    'email'=>'varchar',
    'array'=> 'text',
    'text'=>'text',
    'longtext'=>'longtext',
    'fkey'=>'int',
    'rkey'=>'none',
    'float'=>'float',
    'date'=>'date',
    'time'=>'time',
    'token'=>'varchar',
    'timestamp'=>'datetime',
    'password'=>'varchar',
    'token'=>'varchar',
];

$s=[
    'varchar' => 'VARCHAR(255)',
    // allow larger payloads (e.g. JSON logs)
    'text' => 'TEXT',
    'longtext' => 'LONGTEXT',
    'int' => 'INT',
    'bool' => 'INT(1)',
    'date' => 'DATE',
    'time' => 'TIME',
    'float' => 'FLOAT',
    'datetime' => 'DATETIME'
];

$in=[
    'id' => ['validate/type'=>'integer',],
    'position' => ['validate/type'=>'integer',],
    'word' => ['validate/type'=>'string', 'validate/length'=>255],
    'password' => ['transform/encrypt'=>''],//is_numeric
    'text' => ['validate/type'=>'string',],
    'longtext' => ['validate/type'=>'string',],
    'enum' => ['validate/type'=>'integer',],
    'email' => ['validate/email'=>'',],
    'int' => ['validate/type'=>'integer',],
    'bool' => ['validate/type'=>'integer', 'validate/range'=>['min'=>0, 'max'=>1]],//is int max 0/1
    'date' => ['validate/dateformat'=>''],//dateformat
    'float' => ['validate/numeric'=>''],//is_numeric
];

$out=[
    
];
?>
