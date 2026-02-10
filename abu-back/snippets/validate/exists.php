<?php
    //take model of key instead of key, do after model is restructured as arrays
    if ($value['id'] ?? 0 > 0)
    {
        if (sql_get('SELECT COUNT(*) FROM `'.$key.'` WHERE id='.$value['id'])){
            inf ('existtest passed.');
        }
        else {
            abort ('No '.$key.' entry found for id '.$value['id']);
        }
    }
    else{
        if ($args['required']==true){
            abort($key.' is not set.', $args['required']);
        }
        else{
            warning($key.' is not required.');
        }
    }
?>