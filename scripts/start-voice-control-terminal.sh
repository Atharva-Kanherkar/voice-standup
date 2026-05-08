#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMMAND="cd '$PLUGIN_ROOT'; set -a; source .env; set +a; npm run control"

osascript <<OSA
tell application "Terminal"
  activate
  do script "$COMMAND"
end tell
OSA
