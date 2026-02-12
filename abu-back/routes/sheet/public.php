<?php

$key = trim($paras[0] ?? ($_GET['key'] ?? ''));
if ($key === '') {
    $return['status'] = 400;
    warning('key fehlt');
    return;
}

$result = sql_get(
    'SELECT id, `key`, `name`, content, updated_at, created_at
     FROM `sheet`
     WHERE `key` = "' . sql_escape($key) . '" AND is_current = 1
     ORDER BY updated_at DESC
     LIMIT 1;'
);

if (!count($result)) {
    $return['status'] = 404;
    warning('sheet nicht gefunden');
    return;
}

$return['data'] = $result[0];
return;

?>
