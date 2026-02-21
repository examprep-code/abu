# Copy this file to scripts/deploy/env.local.sh and set production values.

DB_HOST="127.0.0.1"
DB_USER="db_user"
DB_PASSWORD="db_password"
DB_NAME="db_name"

# Empty string if app is served from domain root; otherwise e.g. "api/"
APP_PATH="api/"

# true or false
DEBUG="false"

# Optional. Leave empty to only rely on server environment variable.
OPENAI_API_KEY=""
