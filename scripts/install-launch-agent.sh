#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--print" ]]; then
  node scripts/install-launch-agent.mjs --print
else
  node scripts/install-launch-agent.mjs --install
fi
