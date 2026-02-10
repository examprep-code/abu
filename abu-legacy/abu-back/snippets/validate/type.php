<?php
    if (gettype($value) !== $args && isset($value)){
        if (!settype($value, $args)){
            warning('Variable '.$key.' could not be set.');
        }
        else{
            warning('Variable '.$key.' was transformed to value '.$value.'.');
        }
    }
?>