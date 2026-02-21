# Copy this file to scripts/deploy/config.local.sh and fill in your values.

# Metanet SSH details (support article: use port 2121)
DEPLOY_SSH_HOST="server.host.ch"
DEPLOY_SSH_USER="your-plesk-user"
DEPLOY_SSH_PORT="2121"
DEPLOY_SSH_STRICT_HOST_KEY_CHECKING="accept-new"

# Remote directories inside the chroot shell.
# Common Plesk defaults:
# - frontend in /httpdocs
# - backend in /httpdocs/api
REMOTE_FRONTEND_DIR="/httpdocs"
REMOTE_BACKEND_DIR="/httpdocs/api"
REMOTE_ENV_PHP_PATH="$REMOTE_BACKEND_DIR/env.php"
REMOTE_LOG_FILE="/logs/proxy_error_log"

# Local project directories
LOCAL_FRONTEND_DIR="abu-svelte"
LOCAL_FRONTEND_BUILD_DIR="abu-svelte/build"
LOCAL_BACKEND_DIR="abu-back"
BACKEND_RSYNC_EXCLUDES_FILE="scripts/deploy/rsync-backend-excludes.txt"

# Optional URLs for smoke checks
DEPLOY_FRONTEND_URL="https://example.ch/"
DEPLOY_API_TEST_URL="https://example.ch/api/service/test"
DEPLOY_MIGRATE_URL="https://example.ch/api/service/migrate"
DEPLOY_ALTER_URL="https://example.ch/api/service/alter"
DEPLOY_API_BASE_URL="/api/"
DEPLOY_BACKEND_REWRITE_BASE="/api/"

# Optional command executed on remote host after rsync.
# Example: REMOTE_POST_DEPLOY_CMD="cd /httpdocs/api && /opt/php83/bin/php -l index.php"
REMOTE_POST_DEPLOY_CMD=""

# Local secrets file used by push-env.sh
DEPLOY_ENV_FILE="$PROJECT_ROOT/scripts/deploy/env.local.sh"
