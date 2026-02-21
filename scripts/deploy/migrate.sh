#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<USAGE
Usage: ./scripts/deploy/migrate.sh [options]

Options:
  --alter      Also call /service/alter after migrate
  --only-alter Skip migrate and only call alter
  -h, --help   Show this help
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

require_cmd curl

RUN_MIGRATE=true
RUN_ALTER=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --alter)
      RUN_ALTER=true
      ;;
    --only-alter)
      RUN_MIGRATE=false
      RUN_ALTER=true
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

MIGRATE_URL="${DEPLOY_MIGRATE_URL:-}"
ALTER_URL="${DEPLOY_ALTER_URL:-}"

if [[ -z "$MIGRATE_URL" && -n "${DEPLOY_API_TEST_URL:-}" ]]; then
  MIGRATE_URL="${DEPLOY_API_TEST_URL/service\/test/service\/migrate}"
fi
if [[ -z "$ALTER_URL" && -n "${DEPLOY_API_TEST_URL:-}" ]]; then
  ALTER_URL="${DEPLOY_API_TEST_URL/service\/test/service\/alter}"
fi

if [[ "$RUN_MIGRATE" == "true" ]]; then
  [[ -n "$MIGRATE_URL" ]] || die "Missing DEPLOY_MIGRATE_URL (or DEPLOY_API_TEST_URL to derive it)"
  info "Calling migrate: $MIGRATE_URL"
  curl -fsS --max-time 30 "$MIGRATE_URL" | sed -n '1,30p'
fi

if [[ "$RUN_ALTER" == "true" ]]; then
  [[ -n "$ALTER_URL" ]] || die "Missing DEPLOY_ALTER_URL (or DEPLOY_API_TEST_URL to derive it)"
  info "Calling alter: $ALTER_URL"
  curl -fsS --max-time 30 "$ALTER_URL" | sed -n '1,30p'
fi

info "Migration endpoints finished"
