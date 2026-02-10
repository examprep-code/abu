<?php
    $sum=0;
    foreach ($data[$args['subtable']] as $value2){
        if ($value2[$args['input']]>0)
        {
            $sum+=$value2[$args['input']];
        }
    }    
    $data[$args['output']]=$sum;
?>