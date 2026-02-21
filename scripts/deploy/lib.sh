#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="${DEPLOY_CONFIG_FILE:-$SCRIPT_DIR/config.local.sh}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  cat >&2 <<MSG
Missing deploy config: $CONFIG_FILE

Create it from the example:
  cp "$SCRIPT_DIR/config.example.sh" "$SCRIPT_DIR/config.local.sh"
MSG
  exit 1
fi

# shellcheck source=/dev/null
source "$CONFIG_FILE"

: "${DEPLOY_SSH_HOST:?DEPLOY_SSH_HOST is required in deploy config}"
: "${DEPLOY_SSH_USER:?DEPLOY_SSH_USER is required in deploy config}"

DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-2121}"
DEPLOY_SSH_STRICT_HOST_KEY_CHECKING="${DEPLOY_SSH_STRICT_HOST_KEY_CHECKING:-accept-new}"

LOCAL_BACKEND_DIR="${LOCAL_BACKEND_DIR:-abu-back}"
LOCAL_FRONTEND_DIR="${LOCAL_FRONTEND_DIR:-abu-svelte}"
LOCAL_FRONTEND_BUILD_DIR="${LOCAL_FRONTEND_BUILD_DIR:-abu-svelte/build}"

REMOTE_BACKEND_DIR="${REMOTE_BACKEND_DIR:-/httpdocs/api}"
REMOTE_FRONTEND_DIR="${REMOTE_FRONTEND_DIR:-/httpdocs}"
REMOTE_ENV_PHP_PATH="${REMOTE_ENV_PHP_PATH:-${REMOTE_BACKEND_DIR%/}/env.php}"
REMOTE_LOG_FILE="${REMOTE_LOG_FILE:-/logs/proxy_error_log}"

ssh_target() {
  printf '%s@%s' "$DEPLOY_SSH_USER" "$DEPLOY_SSH_HOST"
}

ssh_exec() {
  ssh -o "StrictHostKeyChecking=${DEPLOY_SSH_STRICT_HOST_KEY_CHECKING}" -p "$DEPLOY_SSH_PORT" "$(ssh_target)" "$@"
}

ssh_shell() {
  ssh -o "StrictHostKeyChecking=${DEPLOY_SSH_STRICT_HOST_KEY_CHECKING}" -p "$DEPLOY_SSH_PORT" "$(ssh_target)"
}

scp_to_remote() {
  local src="$1"
  local dest="$2"
  scp -o "StrictHostKeyChecking=${DEPLOY_SSH_STRICT_HOST_KEY_CHECKING}" -P "$DEPLOY_SSH_PORT" "$src" "$(ssh_target):$dest"
}

rsync_to_remote() {
  local src="$1"
  local dest="$2"
  shift 2
  rsync -az -e "ssh -o StrictHostKeyChecking=${DEPLOY_SSH_STRICT_HOST_KEY_CHECKING} -p ${DEPLOY_SSH_PORT}" "$@" "$src" "$(ssh_target):$dest"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing command: $cmd" >&2
    exit 1
  fi
}

info() {
  printf '[deploy] %s\n' "$*"
}

die() {
  printf '[deploy][error] %s\n' "$*" >&2
  exit 1
}

project_path() {
  local rel="$1"
  printf '%s/%s' "$PROJECT_ROOT" "$rel"
}

php_escape() {
  local value="$1"
  value=${value//\\/\\\\}
  value=${value//\'/\\\'}
  printf '%s' "$value"
}

normalize_bool() {
  local value="${1:-false}"
  shopt -s nocasematch
  case "$value" in
    1|true|yes|on)
      printf 'true'
      ;;
    *)
      printf 'false'
      ;;
  esac
  shopt -u nocasematch
}
