#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

require_cmd ssh
require_cmd curl

info "SSH smoke check"
ssh_exec "echo connected: \$(hostname)"

if [[ -n "${DEPLOY_API_TEST_URL:-}" ]]; then
  info "HTTP API smoke check: $DEPLOY_API_TEST_URL"
  curl -fsS --max-time 25 "$DEPLOY_API_TEST_URL" | sed -n '1,25p'
else
  info "Skipping API smoke check (DEPLOY_API_TEST_URL not set)"
fi

if [[ -n "${DEPLOY_FRONTEND_URL:-}" ]]; then
  info "HTTP frontend headers: $DEPLOY_FRONTEND_URL"
  curl -fsSIL --max-time 25 "$DEPLOY_FRONTEND_URL" | sed -n '1,12p'
else
  info "Skipping frontend smoke check (DEPLOY_FRONTEND_URL not set)"
fi

info "Smoke checks finished"
