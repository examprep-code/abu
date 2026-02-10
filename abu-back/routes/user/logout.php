<?php

if (isset($user['id'])){
    sql_update('user', ['token' => null, 'valid_until' => null, 'updated_at' => date('Y-m-d H:i:s')], $user['id']); 
}
else{
    warning('User not found');
}
?>
