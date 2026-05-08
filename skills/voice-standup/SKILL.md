---
name: voice-standup
description: Use the local Realtime API standup companion to generate a startup briefing and route safe desktop voice commands through an allowlisted action layer.
---

# Voice Standup

Use this skill when the user wants a spoken startup standup, hands-free local task triage, or safe desktop control by voice.

## Workflow

1. Gather local context with `node plugins/voice-standup/scripts/collect-standup-context.mjs`.
2. Generate the briefing with `npm --prefix plugins/voice-standup run standup`.
3. For one short voice command, use `npm --prefix plugins/voice-standup run voice`.
4. For a persistent text loop, use `npm --prefix plugins/voice-standup run listen`.
5. Keep all desktop actions behind allowlisted handlers in `scripts/voice-standup.mjs`.

## Guardrails

- Never execute arbitrary shell from model output.
- Confirm externally visible or destructive actions before running them.
- Prefer read-only commands for the morning standup.
- Keep the standup short: yesterday, today, blockers, first action.

## Realtime Notes

- Default model: `gpt-realtime-2`.
- Default voice for future audio output: `marin`.
- Use WebSocket for the local Node daemon. Use WebRTC if this becomes a browser or mobile UI.
