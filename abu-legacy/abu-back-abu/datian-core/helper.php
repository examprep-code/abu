<?php
$db = mysqli_connect(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
if ($db) {
    mysqli_set_charset($db, 'utf8mb4');
}

function sql_escape($string){
    global $db;
    return mysqli_real_escape_string($db, $string);
}

//executes sql command and returns message;
function sql_set($sql, $return_id=false)
{
    global $db;
    inf ($sql, 'SQL set');
    $message=mysqli_query($db, $sql);
    // Surface DB errors to the response for quicker debugging
    if ($message === false) {
        warning('SQL error: ' . mysqli_error($db));
    }
    if ($return_id){
        return mysqli_insert_id($db);
    }
    inf ($sql, $message);
    return $message;
}

//executes sql command and returns result as an array
function sql_get($sql)
{
    echo $sql;
    inf ($sql, 'SQL get');
    global $db;
    $daten=mysqli_query($db, $sql);
    $return=[];

    if (mysqli_error($db)){
        echo (mysqli_error($db));
    }
    while ($daten && $entry = (mysqli_fetch_assoc($daten)))
    {
        $return[]=$entry;
    }
    return $return;
}


//get entry from model for a specific table and fieldname
function get_model($table, $key)
{
    global $m;
    if (isset($m[$table][$key]))
    {
        //validate if all required parameters are set or set default values
        return $m[$table][$key];
    }
    else{
        inf ('Model of table '.$table.' and key '.$key.' not found.');
        return [''];
    }
}

//converts array of conditions to SQL WHERE string
function where2string($where){
    $return='';
    if (is_array($where) && count($where)){
        $return=' WHERE ';
        foreach ($where as $condition){
            $return.=$condition.' AND ';
        }
        $return=substr($return, 0, -5);
    }
    return $return;
}

function append2string($append){
    $return='';
    if (is_array($append) && count($append)){
        $return=' ';
        foreach ($append as $condition){
            $return.=sql_escape($condition).' ';
        }
        $return=substr($return, 0, -1);
    }
    return $return;
}

//converts array of keys to SQL SELECT string, 
//i.e. all keys if they are strings and are not rkeys and hold an array
function select2string($array, $table){
    $select = 'id, ';
        foreach($array as $key=>$value){   
            if(substr($key,0,1)!=='_')
            {
                if (!is_numeric($key) && !(get_model($table, $key)[0]=='rkey') && is_array($value)){ 
                    $select.='`'.$key.'`, '; 
                }
            }
        }
        $select=substr($select, 0, -2);
        //if ($select=='id, 0'){$select='*';}
        return $select;
}

function json($array) 
{
    $options = JSON_UNESCAPED_UNICODE;
    if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
        $options |= JSON_INVALID_UTF8_SUBSTITUTE;
    }
    $json = json_encode($array, $options);
    if ($json === false) {
        $json = json_encode(
            ['error' => 'json_encode failed', 'message' => json_last_error_msg()],
            JSON_UNESCAPED_UNICODE
        );
    }
    header('Content-Type: application/json; charset=utf-8');
    echo $json;
}

//********************** */

//for debuging: show array


//for debugging: show string
function inf($value, $key=''){
    if (DEBUG)
    {
        global $return;
        if (strlen($key)){
            $count=0;
            while (array_key_exists($key.'_'.$count, $return['debug'])){
                $count++;
            }
            $return['debug'][$key.'_'.$count]=$value;
        }
        else{
            $return['debug'][]=$value;
        }
    }
}

function warning($text, $warning=true){
    global $return;
    if ($warning){
        $return['warning'].=$text.' ';
    }
    else {
        $return['message'].=$text.' ';
    }
}

//not used yet?
function subarray_search($needle, $array, $field=false)
{
    foreach ($array as $key=>$subarray){
        if ($field==false){
            if (in_array($needle, $subarray))
            {
                return ($subarray);
            }
        }
        else{
            if ($subarray[$field]==$needle)
            {
                return ($subarray);
            }
        }
    }
    return [];
}

//returns user by token in authorisation header (token is requzested by user/login.php)
function get_user(){
    $headers = apache_request_headers();
    inf($headers, 'headers');
    $token=$headers['Authorization'] ?? null;
    if ($token)
    {
        $token=sql_escape($token);
        $return = sql_get('SELECT * FROM `da_user` WHERE token = "'.$token.'" AND valid_until>=NOW();');
        if (count($return)){
            inf ($return[0], 'user');
            return $return[0];
        }
        else{
            inf ('Invalid Token');
            return [];
        }
    }
    else{
        return [];
    }
}

function user_role($role){
    global $user;
    if (isset($user[$role]) && $user[$role]){
        inf ('Access granted');
    }
    else{
        abort('You don\'t have the permission to access this resource.');
    }
}

//snippet: include file: snippets/$snippet.php
//target: name (string) of variable name to validate
//array: the whole entry including the variable to validate
//args: arguments to forward to code
//lib: collection of keywords for snippets for this variable, defined in the model
//->call all snippet-calls predefined in the model by a single keyword
function snippet($snippet, $key, &$data, $args, $lib){
    $value = &$data[$key];
    if (is_numeric($snippet) && is_string($args))
    {
        foreach ($lib[$args] ?? [] as $libsnippet=>$libargs)
        {
            snippet($libsnippet, $key, $data, $libargs, $lib);
        }
    }
    else{
        include 'snippets/'.$snippet.'.php';
    }
    //return $data[$key]; //is a return needed???
}

function abort($message, $status=500){
    warning($message);
    http_response_code($status);
    //global $return;
    //return $return;
    terminate();
    //exit;
}

function terminate(){
    global $return;
    if (DEBUG)
    {
        global $microtime;
        $return['log']['time'] = number_format((microtime(true)-$microtime)*1000, 0).'ms';
        inf(ob_get_contents(), 'output');
    }
    http_response_code($return['status'] ?? 200);
    ob_end_clean();
    json($return);
    exit;
}

function random($n) {
    $characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $randomString = '';
 
    for ($i = 0; $i < $n; $i++) {
        $index = rand(0, strlen($characters) - 1);
        $randomString .= $characters[$index];
    }
 
    return $randomString;
}

//Serving a route. Needs the method and an array and it will call get or set methods
function serve($array, $methods=['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], $middleware=[]){
    global $method;
    global $return;
    global $data;
    global $paras;

    inf ($data, 'sent json data');
    if (in_array($method, $methods)){
        foreach ($middleware as $snippet=>$arguments){
            //execute middleware
        }
        if ($method=='GET'){
            if (!count($paras)){ //if !isset id
                $return['data']= array_merge($return['data'], get($array));
            }
            else{ //if the call has a parameter for the id just get the single entry, it's only done for the first entry in the array
                reset($array);
                $key = key($array);
                $array[$key]=array_merge(['_where'=>['id = '.$paras[0]]], $array[$key]);
                $return['data']= array_merge($return['data'], get($array));
                reset($return['data']);
                $key = key($return['data']);
                $return['data']=$return['data'][$key][0] ?? [];
            }
        }
        else{
            foreach ($array as $key=>$value)
            {
                set(
                    $key,
                    $value, 
                    [$data],
                    $method
                );
            }
        }
    }
}

function all($table, &$array){
    global $m;
    foreach ($m[$table] as $key=>$value){
        if (!in_array($value[0], ['id', 'rkey', 'password', 'token'])){
            if (!isset($array[$key])){
                $array[$key]=[];
            }
        }
    }
    unset($array[array_search('all', $array)]);
}

function flag($flag, $array){
    foreach ($array as $key => $value) {
        if (is_int($key)) {
          if ($value==$flag){
            return true;
        }
      }
    }
    return false;
}


?>
