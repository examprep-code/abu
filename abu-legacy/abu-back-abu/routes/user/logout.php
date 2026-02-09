<?php

if (isset($user['id'])){
    sql_update('da_user', ['token' => null, 'valid_until' => null], $user['id']); 
}
else{
    warning('User not found');
}
?>