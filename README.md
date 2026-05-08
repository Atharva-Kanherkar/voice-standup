# Voice Standup

Local Codex plugin for a Realtime API desktop companion:

- On startup, automatically gather recent work across local git repos and GitHub activity.
- Ask `gpt-realtime-2` for a concise standup.
- Speak the standup with macOS `say` when available.
- Keep desktop control behind explicit local allowlists.

This is an early prototype. It is useful for hackers who are comfortable running a local plugin and setting their own OpenAI API key.

## Setup

```bash
git clone https://github.com/Atharva-Kanherkar/voice-standup.git
cd voice-standup
npm install
cp .env.example .env
```

Set your API key:

```bash
export OPENAI_API_KEY="sk-..."
npm run standup
```

The prototype uses the OpenAI Realtime WebSocket API:

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

## Startup on macOS

Preview the LaunchAgent:

```bash
./scripts/install-launch-agent.sh --print
```

Install it:

```bash
./scripts/install-launch-agent.sh
launchctl load "$HOME/Library/LaunchAgents/dev.agentclash.voice-standup.plist"
```

Set `OPENAI_API_KEY` in your shell environment or in a secure launchd-compatible secret flow before enabling the agent.

The LaunchAgent runs one startup standup. It does not start a continuous microphone listener.

## Voice Path

The prototype includes a short voice-input path through `sox` or macOS `ffmpeg`:

```bash
npm run voice
```

That records a short utterance, sends PCM audio to the Realtime API, and speaks the model's text answer with macOS `say`. If recording fails, grant microphone permission to your terminal app or install `sox` with `brew install sox`. The continuous wake-word/listening loop is intentionally left as the next layer so startup automation does not accidentally keep a hot mic running without an explicit install decision.

## Safety Model

Desktop actions must be allowlisted in `scripts/voice-standup.mjs`. Anything that sends messages, deletes files, purchases, installs software, edits system settings, or runs arbitrary shell commands should require an explicit confirmation step.

## Sharing Notes

- Do not commit `.env` or API keys.
- Do not commit `node_modules/`.
- If you publish this as a Codex marketplace plugin later, update `.codex-plugin/plugin.json` with real homepage, repository, logo, and screenshot URLs.
