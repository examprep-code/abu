#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

require_cmd ssh
require_cmd ssh-keygen
require_cmd scp

KEY_PATH="${1:-$HOME/.ssh/id_ed25519}"
PUB_KEY_PATH="${KEY_PATH}.pub"
REMOTE_TMP_KEY='~/.ssh/codex_upload_key.pub'

if [[ ! -f "$PUB_KEY_PATH" ]]; then
  info "Creating SSH key: $KEY_PATH"
  ssh-keygen -t ed25519 -f "$KEY_PATH" -N ''
fi

info "Preparing ~/.ssh/authorized_keys on remote"
ssh_exec "mkdir -p ~/.ssh && chmod 755 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 644 ~/.ssh/authorized_keys"

info "Uploading public key"
scp_to_remote "$PUB_KEY_PATH" "$REMOTE_TMP_KEY"

info "Installing key into authorized_keys"
ssh_exec "if ! grep -qxF \"\$(cat $REMOTE_TMP_KEY)\" ~/.ssh/authorized_keys; then cat $REMOTE_TMP_KEY >> ~/.ssh/authorized_keys; fi; rm -f $REMOTE_TMP_KEY"

info "SSH key setup complete"
