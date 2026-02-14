#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/abu-svelte"

if [ ! -d "$APP_DIR" ]; then
  echo "Error: expected app directory at $APP_DIR"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm not found in PATH"
  exit 1
fi

cd "$APP_DIR"

if [ ! -d node_modules ]; then
  echo "Error: node_modules missing. Run: npm install"
  exit 1
fi

npm run build
