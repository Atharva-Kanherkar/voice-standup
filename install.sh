#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${VOICE_STANDUP_REPO_URL:-https://github.com/Atharva-Kanherkar/voice-standup.git}"
INSTALL_DIR="${VOICE_STANDUP_INSTALL_DIR:-$HOME/plugins/voice-standup}"
MARKETPLACE_PATH="${VOICE_STANDUP_MARKETPLACE_PATH:-$HOME/.agents/plugins/marketplace.json}"

mkdir -p "$(dirname "$INSTALL_DIR")"

if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
npm install

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

mkdir -p "$(dirname "$MARKETPLACE_PATH")"

node <<'NODE' "$MARKETPLACE_PATH" "$INSTALL_DIR"
const fs = require("fs");
const path = require("path");

const marketplacePath = process.argv[2];
const installDir = process.argv[3];
const entry = {
  name: "voice-standup",
  source: {
    source: "local",
    path: installDir,
  },
  policy: {
    installation: "AVAILABLE",
    authentication: "ON_INSTALL",
  },
  category: "Productivity",
};

let payload = {
  name: "local-plugins",
  interface: { displayName: "Local Plugins" },
  plugins: [],
};

if (fs.existsSync(marketplacePath)) {
  payload = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
  payload.interface ||= { displayName: "Local Plugins" };
  payload.plugins ||= [];
}

const index = payload.plugins.findIndex((plugin) => plugin.name === entry.name);
if (index >= 0) payload.plugins[index] = entry;
else payload.plugins.push(entry);

fs.mkdirSync(path.dirname(marketplacePath), { recursive: true });
fs.writeFileSync(marketplacePath, `${JSON.stringify(payload, null, 2)}\n`);
NODE

cat <<EOF

Voice Standup installed.

Plugin: $INSTALL_DIR
Marketplace entry: $MARKETPLACE_PATH

Next:
  1. Add OPENAI_API_KEY to $INSTALL_DIR/.env
  2. Run:
     cd "$INSTALL_DIR"
     set -a; source .env; set +a
     npm run standup

EOF
