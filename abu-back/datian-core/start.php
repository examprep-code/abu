<?php
ob_start();
$microtime=microtime(true);
error_reporting(E_ALL);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: *');
header('Access-Control-Allow-Headers: *');


include_once 'env.php';

// Store and serialize backend timestamps consistently in UTC.
date_default_timezone_set('UTC');

ini_set('display_errors', DEBUG ? '1' : '0');

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

// Dev convenience: keep DB schema in sync with models.
if (DEBUG) {
    $autoMigrateEnv = getenv('AUTO_MIGRATE');
    $autoMigrateVal = $autoMigrateEnv === false ? '' : strtolower(trim($autoMigrateEnv));
    $autoMigrate = $autoMigrateVal === '' || in_array($autoMigrateVal, ['1', 'true', 'yes'], true);
    if ($autoMigrate) {
        $hasSheetPrompt = !empty(sql_get('SHOW COLUMNS FROM `sheet` LIKE "prompt";'));
        $hasUserRole = !empty(sql_get('SHOW COLUMNS FROM `user` LIKE "role";'));
        $hasClassroomPrompt = !empty(sql_get('SHOW COLUMNS FROM `classroom` LIKE "prompt";'));
        $hasLearnerPrompt = !empty(sql_get('SHOW COLUMNS FROM `learner` LIKE "prompt";'));
        $hasSchoolPrompt = !empty(sql_get('SHOW COLUMNS FROM `school` LIKE "prompt";'));
        $hasCollectionTable = !empty(sql_get("SHOW TABLES LIKE 'collection';"));
        $hasCollectionSheetTable = !empty(sql_get("SHOW TABLES LIKE 'collection_sheet';"));
        $hasCollectionDescription =
            $hasCollectionTable &&
            !empty(sql_get('SHOW COLUMNS FROM `collection` LIKE "description";'));
        $hasCollectionPosition =
            $hasCollectionSheetTable &&
            !empty(sql_get('SHOW COLUMNS FROM `collection_sheet` LIKE "position";'));
        if (
            !$hasSheetPrompt ||
            !$hasUserRole ||
            !$hasClassroomPrompt ||
            !$hasLearnerPrompt ||
            !$hasSchoolPrompt ||
            !$hasCollectionTable ||
            !$hasCollectionSheetTable ||
            !$hasCollectionDescription ||
            !$hasCollectionPosition
        ) {
            require_once 'datian-core/migration.php';
            init_sql();
            alter_sql();
        }
    }
}

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

if (isset($user['id']) && user_role_value($user) === 0) {
    $allowed = ['user/login', 'user/logout'];
    if (!in_array($path, $allowed, true)) {
        $return['status'] = 403;
        warning('Account wartet auf Aktivierung.');
        terminate();
    }
}

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
