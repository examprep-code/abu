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

// Optional agent logging config
// define("AGENT_LOG_ENABLED", true);
// define("AGENT_LOG_REDACT", true);
// define("AGENT_LOG_DIR", __DIR__ . "/storage/agent-logs");
// define("AGENT_LOG_MAX_STRING", 18000);
// define("AGENT_LOG_MAX_ITEMS", 250);
// define("AGENT_LOG_MAX_DEPTH", 10);

// Optional model routing (comma-separated fallbacks)
// define("AGENT_INTENT_MODEL", "gpt-4o-mini");
// define("AGENT_INTENT_FALLBACK_MODELS", "gpt-4.1-mini");
// define("AGENT_MAIN_MODEL", "gpt-4.1-mini");
// define("AGENT_MAIN_FALLBACK_MODELS", "gpt-4o-mini");
// define("AGENT_GRADING_MODEL", "gpt-4.1-mini");
// define("AGENT_GRADING_FALLBACK_MODELS", "gpt-4o-mini");
?>
