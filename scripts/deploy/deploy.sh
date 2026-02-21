#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<USAGE
Usage: ./scripts/deploy/deploy.sh [options]

Options:
  --backend-only   Deploy only backend
  --frontend-only  Deploy only frontend
  --skip-build     Skip frontend build
  --skip-tests     Skip smoke tests
  -h, --help       Show this help
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

DEPLOY_BACKEND=true
DEPLOY_FRONTEND=true
RUN_BUILD=true
RUN_TESTS=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only)
      DEPLOY_BACKEND=true
      DEPLOY_FRONTEND=false
      ;;
    --frontend-only)
      DEPLOY_BACKEND=false
      DEPLOY_FRONTEND=true
      ;;
    --skip-build)
      RUN_BUILD=false
      ;;
    --skip-tests)
      RUN_TESTS=false
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
  shift
done

require_cmd ssh
require_cmd rsync

BACKEND_LOCAL="$(project_path "$LOCAL_BACKEND_DIR")"
FRONTEND_LOCAL="$(project_path "$LOCAL_FRONTEND_DIR")"
FRONTEND_BUILD_LOCAL="$(project_path "$LOCAL_FRONTEND_BUILD_DIR")"

if [[ "$DEPLOY_FRONTEND" == "true" && "$RUN_BUILD" == "true" ]]; then
  require_cmd npm
  info "Building frontend in $FRONTEND_LOCAL"
  (
    cd "$FRONTEND_LOCAL"
    if [[ ! -d node_modules ]]; then
      info "node_modules missing -> npm ci"
      npm ci
    fi
    npm run build
  )

  if [[ -n "${DEPLOY_API_BASE_URL:-}" ]]; then
    info "Overriding frontend runtime config apiBaseUrl -> $DEPLOY_API_BASE_URL"
    cat > "$FRONTEND_BUILD_LOCAL/config.json" <<JSON
{
  "apiBaseUrl": "$DEPLOY_API_BASE_URL"
}
JSON
  fi
fi

if [[ "$DEPLOY_FRONTEND" == "true" ]]; then
  [[ -d "$FRONTEND_BUILD_LOCAL" ]] || die "Frontend build output not found: $FRONTEND_BUILD_LOCAL"
  info "Ensuring remote frontend directory exists: $REMOTE_FRONTEND_DIR"
  ssh_exec "mkdir -p '$REMOTE_FRONTEND_DIR'"

  info "Uploading frontend build -> $(ssh_target):$REMOTE_FRONTEND_DIR"
  rsync_to_remote "$FRONTEND_BUILD_LOCAL/" "$REMOTE_FRONTEND_DIR/" --delete --exclude api/
fi

if [[ "$DEPLOY_BACKEND" == "true" ]]; then
  [[ -d "$BACKEND_LOCAL" ]] || die "Local backend directory not found: $BACKEND_LOCAL"
  info "Ensuring remote backend directory exists: $REMOTE_BACKEND_DIR"
  ssh_exec "mkdir -p '$REMOTE_BACKEND_DIR'"

  RSYNC_ARGS=(--delete)
  if [[ -n "${BACKEND_RSYNC_EXCLUDES_FILE:-}" ]]; then
    EXCLUDE_FILE="$(project_path "$BACKEND_RSYNC_EXCLUDES_FILE")"
    if [[ -f "$EXCLUDE_FILE" ]]; then
      RSYNC_ARGS+=(--exclude-from "$EXCLUDE_FILE")
    fi
  fi

  info "Uploading backend -> $(ssh_target):$REMOTE_BACKEND_DIR"
  rsync_to_remote "$BACKEND_LOCAL/" "$REMOTE_BACKEND_DIR/" "${RSYNC_ARGS[@]}"

  if [[ -n "${DEPLOY_BACKEND_REWRITE_BASE:-}" ]]; then
    info "Setting backend RewriteBase -> $DEPLOY_BACKEND_REWRITE_BASE"
    ssh_exec "if [ -f '$REMOTE_BACKEND_DIR/.htaccess' ]; then sed -i 's#^RewriteBase .*\$#RewriteBase ${DEPLOY_BACKEND_REWRITE_BASE}#' '$REMOTE_BACKEND_DIR/.htaccess'; fi"
  fi
fi

if [[ -n "${REMOTE_POST_DEPLOY_CMD:-}" ]]; then
  info "Running remote post deploy command"
  ssh_exec "$REMOTE_POST_DEPLOY_CMD"
fi

if [[ "$RUN_TESTS" == "true" ]]; then
  "$SCRIPT_DIR/test.sh"
fi

info "Deploy finished"
