# Voice Standup

> A local Codex plugin that uses the OpenAI Realtime API to give you a spoken developer standup from everything you touched in the last 24 hours.

[![GitHub stars](https://img.shields.io/github/stars/Atharva-Kanherkar/voice-standup?style=social)](https://github.com/Atharva-Kanherkar/voice-standup/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Realtime API](https://img.shields.io/badge/OpenAI-Realtime_API-10A37F)](https://platform.openai.com/docs/guides/realtime)

Voice Standup is a local-first Codex plugin for an OpenAI Realtime powered desktop companion:

- On startup, automatically gather recent work across local git repos and GitHub activity.
- Ask `gpt-realtime-2` for a concise standup.
- Speak the standup with macOS `say` when available.
- Keep desktop control behind explicit local allowlists.

It is built for builders who wake up, open the machine, and want: “What did I do yesterday, what matters today, what is blocked, and what should I do first?”

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/Atharva-Kanherkar/voice-standup/main/install.sh | bash
```

Then add your API key:

```bash
cd ~/plugins/voice-standup
cp .env.example .env
open .env
```

Run your first standup:

```bash
set -a; source .env; set +a
npm run standup
```

Control it with your voice:

```bash
npm run control
```

## Manual Setup

```bash
git clone https://github.com/Atharva-Kanherkar/voice-standup.git
cd voice-standup
npm install
cp .env.example .env
```

Set your API key in `.env` or your shell:

```bash
OPENAI_API_KEY="sk-..."
```

Run:

```bash
npm run standup
```

Voice Standup uses the OpenAI Realtime WebSocket API:

```text
wss://api.openai.com/v1/realtime?model=gpt-realtime-2
```

## Standup Context

By default, Voice Standup scans recent activity from the last 24 hours across:

- local git repos under your home directory and common work folders
- changed, untracked, and recently committed files
- authenticated GitHub events through `gh`, when available
- lightweight project docs such as `README.md`, `AGENTS.md`, and `TODO.md`

You usually do not need to configure anything. Optional overrides are available for unusual setups:

```bash
VOICE_STANDUP_LOOKBACK_HOURS=24
VOICE_STANDUP_MAX_REPOS=12
VOICE_STANDUP_SCAN_ROOTS="/path/to/repos,/another/path"
```

## Codex Plugin Install

This repo includes a Codex plugin manifest at `.codex-plugin/plugin.json`, an MCP server config at `.mcp.json`, and a skill at `skills/voice-standup/SKILL.md`.

If your Codex build supports local plugin marketplaces, the installer writes a local marketplace entry to:

```text
~/.agents/plugins/marketplace.json
```

That makes the plugin available as a local plugin source. Public search/discovery inside Codex appears to be curated/indexed separately, so GitHub publishing alone may not immediately make it show up next to plugins like Supabase. This repo is structured so it can be submitted or indexed when a public plugin submission path is available.

## Startup on macOS

Preview the LaunchAgent:

```bash
./scripts/install-launch-agent.sh --mode=control --print
```

Install voice control at login:

```bash
npm run startup:control
launchctl unload "$HOME/Library/LaunchAgents/dev.agentclash.voice-standup.plist" 2>/dev/null || true
launchctl load "$HOME/Library/LaunchAgents/dev.agentclash.voice-standup.plist"
```

This opens a Terminal window at login and runs `npm run control`. macOS microphone permissions work much more reliably this way than from a headless background process. Grant Microphone access to Terminal when macOS asks.

Or install one startup standup instead of persistent voice control:

```bash
npm run startup:standup
launchctl unload "$HOME/Library/LaunchAgents/dev.agentclash.voice-standup.plist" 2>/dev/null || true
launchctl load "$HOME/Library/LaunchAgents/dev.agentclash.voice-standup.plist"
```

The LaunchAgent loads `.env` automatically before starting. Voice-control mode records short commands instead of keeping a continuous hot mic running.

## Voice Path

The prototype includes a short voice-input path through `sox` or macOS `ffmpeg`.

For one spoken prompt:

```bash
npm run voice
```

For repeated voice control:

```bash
npm run control
```

Try saying:

- "standup"
- "open calendar"
- "open notes"
- "git status"
- "quit"

That records a short utterance, sends PCM audio to the Realtime API, maps it to an allowlisted action, and speaks the result with macOS `say`. If recording fails, grant microphone permission to your terminal app or install `sox` with `brew install sox`. Voice control records short commands instead of keeping a continuous hot mic running.

## Safety Model

Desktop actions must be allowlisted in `scripts/voice-standup.mjs`. Anything that sends messages, deletes files, purchases, installs software, edits system settings, or runs arbitrary shell commands should require an explicit confirmation step.

## Why It Is Different

- It does not only summarize one repo.
- It auto-detects recent local project work.
- It blends local git activity with GitHub events.
- It speaks your standup out loud.
- It is intentionally local-first: your API key stays on your machine.

## Roadmap

- Continuous push-to-talk mode.
- Wake word support.
- Better microphone device selection UI.
- Calendar and issue tracker context.
- Better wake-at-login setup during install.
- Marketplace-ready screenshots and icons.

## Sharing

- Do not commit `.env` or API keys.
- Do not commit `node_modules/`.
- If you publish this as a Codex marketplace plugin later, update `.codex-plugin/plugin.json` with real homepage, repository, logo, and screenshot URLs.

Useful tags: `codex-plugin`, `openai-realtime`, `realtime-api`, `voice-agent`, `developer-productivity`, `standup-bot`, `mcp-server`, `local-first-ai`.
