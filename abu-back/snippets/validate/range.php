<?php
if ($value>$args['max']){
    $value=$args['max'];
    inf('Value '.$key.' was too high and set to '.$value.'.');
}
if ($value<$args['min']){
    $value=$args['min'];
    inf('Value '.$key.' was too high and set to '.$value.'.');
}
?>