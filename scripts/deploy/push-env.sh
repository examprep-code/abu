#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

require_cmd ssh
require_cmd scp

ENV_FILE_PATH="${1:-${DEPLOY_ENV_FILE:-$SCRIPT_DIR/env.local.sh}}"
[[ -f "$ENV_FILE_PATH" ]] || die "Missing env file: $ENV_FILE_PATH"

# shellcheck source=/dev/null
source "$ENV_FILE_PATH"

: "${DB_HOST:?DB_HOST missing in $ENV_FILE_PATH}"
: "${DB_USER:?DB_USER missing in $ENV_FILE_PATH}"
: "${DB_PASSWORD:?DB_PASSWORD missing in $ENV_FILE_PATH}"
: "${DB_NAME:?DB_NAME missing in $ENV_FILE_PATH}"

APP_PATH_VALUE="${APP_PATH:-}"
DEBUG_VALUE="$(normalize_bool "${DEBUG:-false}")"
OPENAI_KEY_VALUE="${OPENAI_API_KEY:-}"

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

cat > "$TMP_FILE" <<PHP
<?php

define ("DB_HOST", '$(php_escape "$DB_HOST")');
define ("DB_USER", '$(php_escape "$DB_USER")');
define ("DB_PASSWORD", '$(php_escape "$DB_PASSWORD")');
define ("DB_NAME", '$(php_escape "$DB_NAME")');

define ("DEBUG", ${DEBUG_VALUE});
define ("PATH", '$(php_escape "$APP_PATH_VALUE")');
define ("OPENAI_API_KEY", '$(php_escape "$OPENAI_KEY_VALUE")');

?>
PHP

REMOTE_ENV_DIR="$(dirname "$REMOTE_ENV_PHP_PATH")"
info "Ensuring remote env directory exists: $REMOTE_ENV_DIR"
ssh_exec "mkdir -p '$REMOTE_ENV_DIR'"

info "Uploading env.php -> $(ssh_target):$REMOTE_ENV_PHP_PATH"
scp_to_remote "$TMP_FILE" "$REMOTE_ENV_PHP_PATH"
ssh_exec "chmod 640 '$REMOTE_ENV_PHP_PATH'"

info "env.php updated"
