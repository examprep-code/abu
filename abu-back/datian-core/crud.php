<?php

//Remember:
//Always wrap input in array ([]) if only one entry is updated
//Sub-Edit of fkey is supported, not for rkey yet
//Todo: recursive set method: Update, create and delete with nested entries. 
//Also make snippets for this

//creates, updates or deletes entries and their related tables
function set ($table, $array, $data, $mode='POST'){
    global $m;
    include_once 'model/'.$table.'.php';

    //add all non-key variables from model if the _all flag has been set
    if (flag('all', $array))
    {
        all($table, $array);
    }

    $array['id']=[]; //id is always set, because it is the primary key
    //for each entry in the input array: create a post-array and execute it
    foreach ($data as $data)
    {
        $post=[];

        foreach ($array['_snippets']??[] as $snippet=>$args){
            snippet($snippet, $table, $data, $args, $m[$table]['_snippets'] ?? []);
        }

        //process input data thru form-array
        foreach($array as $key=>$value)
        {
            $model=get_model($table, $key);
    

            if (!is_array($value))  //set hardcoded value
            {
                $post[$key]=$value;
            }
            else{
                if (!substr($key,0,1)!=='_' && !is_numeric($key))
                {
                    if ($model[0] !=='fkey' && $model[0]!=='rkey')
                    {
                        foreach ($value as $snippet=>$args)
                        {
                            snippet($snippet, $key, $data, $args, $model['snippets']??[]);
                        }
                    }
                    global $in;
                    foreach ($in[$model[0]] ?? [] as $snippet=>$args)
                    {
                        snippet($snippet, $key, $data, $args, $model['snippets']??[]);
                    }

                    if ($model[0]=='id') //if it's the id
                    {
                        if (!isset($data[$key])){
                            //don't do anything if id is not set
                        }
                        else if (($mode=='POST' || $mode=='PUT'))
                        {
                            $post['id']=$data[$key]; //id is a normal post variable
                        }
                        else
                        {
                            $id=$data[$key]; //id is a seperate variable $id for the where clause
                        }
                    }
                    else if ($model[0]=='fkey') //set id if n:1 linked table, or 
                    {
                        if (isset($data[$key]['id'])){
                            $post[$key]=$data[$key]['id']; //id is a normal post variable
                            //insert set child function here: update 
                            //set($model['table'], $array[$key], [$data[$key]], $mode);
                        }
                    }
                    else if ($model[0]=='rkey') //don't do anything for rkeys
                    {
                    }
                    else if ($model[0]=='position' && isset($data[$key])){
                        //only do if position already exist for unique variables
                        $sql='UPDATE `'.$table.'` SET '.$key.' = '.$key.'+1 WHERE '.$key.' >= '.$data[$key];
                        foreach ($model['unique'] ?? [] as $unique){
                            if (is_array($data[$unique])){
                                if (isset($data[$unique]['id'])){
                                    $sql.=' AND '.$unique.' = '.$data[$unique]['id'];
                                }
                                else{
                                    $sql.=' AND ISNULL('.$unique.')';
                                }
                            }
                            else{
                                $sql.=' AND '.$unique.' = '.$unique_value;
                            }
                        }
                        /*foreach  ($model as $modelkey=>$modelvalue){
                            if ($key>0){
                                $sql.=' AND '.$modelvalue.'="'.$value;
                            }
                        }*/
                        inf($sql);
                        sql_set($sql);
                        $post[$key]=$data[$key];
                    }
                    else if (isset($data[$key]))
                    {
                        $post[$key]=$data[$key];
                    }
                    else{
                        inf($data, 'data');
                        inf($key, 'key');
                    }
                }
            }
            
            
            //if key links to a foreign table: recusive call this function for related table
            if ($model[0]=='fkey' || $model[0]=='rkey') 
            {
                $where=[];
                $subtable=$model['table'];
                if ($model[0]=='fkey') //for n:1 -> execute subtable with where clause
                {
                    //do this:
                    //set($model['table'], $value, $data, $mode);
                    //catch id of this entry
                    //set value = this id

                    //entry is nowhere defined, please check
                    //var_dump($entry);
                    //$where[]=$entry[$model[2]].'='.$entry[$model[1]];
                    //set($subtable, $value, $data[$subtable], $mode)[0]??[];
                } 
                elseif ($model[0]=='rkey') //for 1:n -> execute subtable linked to id from this table
                {
                    $value[$model['key']]=$id;
                    set($subtable, $value, $data[$subtable], $mode)[$subtable];
                } 
            }
            
        }

        //execute array as sql command depending on mode
        
        switch ($mode) 
        {
            case 'POST': 
                global $return;
                unset($post['id']);
                $return['data']= ['id'=>sql_create($table, $post)];
                break;
            case 'PUT': 
                if (isset($post['id']))
                {
                    sql_update($table, $post, $post['id']);
                    break; 
                }
                else
                {
                    $return['data']= ['id'=>sql_create($table, $post)];
                    break;
                }
            case 'PATCH': 
                if (is_numeric($id)){
                    sql_update($table, $post, $id);
                }
                //if isset where update where
                else {
                    warning('Id is not set. Entry was not updated');
                }
                break; 
            case 'DELETE': 
                if (is_numeric($id)){
                    sql_delete($table, $id);
                }
                //if isset where delete where
                else {
                    warning('Id is not set. Entry was not deleted.');
                }
                break; 
        }

    }
}

//returns part of the model
function get($output) //first position = tablename, condition = condition
{
    global $m;
    $result=[];
    foreach ($output as $table=>$array)
    {
        include_once 'model/'.$table.'.php';

        //add all non-key variables from model if the _all flag has been set
        if (flag('all', $array))
        {
            all($table, $array);
        }

        
        //set condition from all elements of array[0]
        $where=where2string($array['_where']??[]);
        $append=append2string($array['_append']??[]);
        //inf($array['_append'], 'APPEND');
        
        //define variables to retrieve
        $select=select2string($array, $table);
        //retrieve entries from DB
        $result[$table]=sql_get('SELECT '.$select.' FROM `'.$table.'`'.$where.' '.$append.';');

        foreach ($result[$table] as $index=>&$entry)
        {
            //display the row according to array 
            foreach ($array as $key=>$value)
            {
                if (substr($key,0,1)!=='_' && !is_numeric($key))
                {
                    //if its a variable (i.e. key!==0) or in future first char of key !=='_'
                    
                    $model=get_model($table, $key);

                    //if key links to a foreign table
                    if (isset($model[0]) && ($model[0]=='fkey' || $model[0]=='rkey')) 
                    {
                        $where=[];
                        $subtable=$model['table'];
                        
                        if ($model[0]=='fkey')
                        {
                            inf (['value'=>$value, 'key'=>$key]);
                            //if the array is empty or missing, don't do a subquery
                            if (!isset($value)){ //??here was checked if $value[$key] does not exist
                                
                            }
                            //if the array is empty, just place the array with only the id in the subarray
                            else if ((is_array($value) && !count($value))){
                                $entry[$key] = ['id'=>$entry[$key]];
                            }
                            else //if there's an array with elements: do a subquery
                            {
                                $fkValue = $entry[$key] ?? ($entry[$model['table']] ?? null);
                                if ($fkValue === null || $fkValue === '') {
                                    $entry[$key] = [];
                                } else {
                                    $where[]=$model['key'].'='.$fkValue;
                                    if (isset($value['_where']) && is_array($value['_where'])){ //is this if condition necessary? is it possible that $where already holds conditions?
                                        $value['_where']=array_merge($value['_where'], $where);
                                    }
                                    else{
                                        $value['_where']=$where;
                                    }
                                    $entry[$model['table']]=get([$subtable=>$value])[$model['table']][0]??[];
                                }
                            }
                        } // 
                        elseif ($model[0]=='rkey')
                        {
                            $where=$model['key'].'='.$entry['id'];
                            $value['_where'][]=$where;
                            $entry[$key]=get([$subtable=>$value])[$subtable];
                        } 
                    }
                    global $out;
                    //call snippets from type of the variable defined in $out
                    foreach ($out[$model[0]] ?? [] as $snippet=>$args)
                    {
                        snippet($snippet, $key, $entry, $args, $model['snippets']??[]);
                    }
                }
                if (isset($model[0]) && $model[0]!=='rkey' && $model[0]!=='fkey' && is_array($value)){
                    //call snippets from variable in array
                    foreach ($value as $snippet=>$args)
                    {
                        snippet($snippet, $key, $entry, $args, $model['snippets']??[]);
                    }
                }
            }
            //call snippets from "_snippets" in array
            foreach ($array['_snippets']??[] as $snippet=>$args){
                snippet($snippet, $key, $entry, $args, $m[$table]['_snippets'] ?? []);
            }
        }
    }
    return $result;
}


//*********************************************************************** */

//creates sql string to insert new entry and executes it
function sql_create($table, $array){
    if (count($array)){
        $sql='REPLACE INTO `'.$table.'`';
        $columns='';
        $values='';
        foreach  ($array as $column=>$value){
            $columns.='`'.$column.'`, ';
            if (strlen($value)){
                $values.='"'.sql_escape($value).'", ';
            }
            else{
                $values.='null, ';
            }
        }
        $columns=substr($columns, 0, -2);
        $values=substr($values, 0, -2);
        // use the aggregated $values string rather than the last-loop $value
        $sql.=' ('.$columns.') VALUES ('.$values.');';
        return sql_set($sql, true);
    }
}

//creates sql string to update entry and executes it
function sql_update($table, $array, $id)
{ 
    if (count($array)){
        $sql='UPDATE `'.$table.'` SET ';
        foreach  ($array as $column=>$value){
            if (strlen($value)){
                $sql.='`'.$column.'`="'.sql_escape($value).'", ';
            }
            else{
                $sql.=$column.'=null, ';
            }
        }
        $sql=substr($sql, 0, -2);
        $sql.=' WHERE id ='.$id.';';
        return sql_set($sql);
    }
}

//deletes entry $id from $table
function sql_delete($table, $id)
{
    $sql='DELETE FROM `'.$table;
    $sql.='` WHERE id ='.$id.';';
    sql_set($sql);
}
