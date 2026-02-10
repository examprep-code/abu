<?php
if (!filter_var($value, FILTER_VALIDATE_EMAIL)){
    warning($value.' is not a valid email address.');
}
?>