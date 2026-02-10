<?php
ob_start();
$microtime=microtime(true);
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: *');
header('Access-Control-Allow-Headers: *');


include_once 'env.php';

//require 'vendor/autoload.php';
foreach (glob("settings/*.php") as $filename)
{
    include_once $filename;
}

include_once 'datian-core/helper.php';
include_once 'datian-core/crud.php';

//make path an array
$return = ['message'=>'', 'warning'=>'', 'debug'=>[], 'data'=>[], 'log'=>[] ];
$path = $_SERVER['REQUEST_URI'];

$path = explode( '?', $path)[0]; //omit GET parameters
$path = explode( '//', $path); //get parameters after the "//"

//echo ob_end_flush();

if (isset ($path[1])){ //if there are any parameters ...
    // Transform parameters after '//' into an array and URL-decode them (e.g. spaces in names)
    if ($path[1] !== '') {
        $paras = array_map('rawurldecode', explode('/', $path[1]));
    } else {
        $paras = [];
    }
}
else{
    $paras = []; //...or else set an empty array
}
$path = $path[0];

$path = substr($path, strlen(PATH)+1);
$method = $_SERVER['REQUEST_METHOD'];
if (DEBUG)
{
    $return['log']['method'] = $method;
    $return['log']['input'] = file_get_contents("php://input");
}

// Handle CORS preflight quickly
if ($method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$user = get_user();

$data = json_decode(file_get_contents("php://input"), TRUE);

//  is_dir ( string $filename ) : bool — Prüft, ob der angegebene Dateiname ein Verzeichnis ist
// file_exists ( string $filename ) : bool
// Check file, check folder, Pass rest to function
if ($path!=='')
{
    include_once 'routes/'.$path.'.php';
}
else {
    include_once 'routes/index.php';
}
terminate();
?>
