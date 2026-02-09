<?php

define ("DB_HOST", "localhost"); 
define ("DB_USER", "root");
define ("DB_PASSWORD", "root");
define ("DB_NAME", "depot");

define ("DEBUG", true);
define ("PATH", 'datian-framework/');

define ("OPENAI_API_KEY", 'datian-framework/');

// OpenAI: entweder via Umgebungsvariable OPENAI_API_KEY setzen oder hier eintragen
if (!defined('OPENAI_API_KEY')) {
    $envApi = getenv('OPENAI_API_KEY');
    define("OPENAI_API_KEY", $envApi !== false ? $envApi : '');
}
?>
