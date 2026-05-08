# Contributing

Thanks for wanting to improve Voice Standup.

## Local Development

```bash
git clone https://github.com/Atharva-Kanherkar/voice-standup.git
cd voice-standup
npm install
cp .env.example .env
npm run check
```

Set `OPENAI_API_KEY` in `.env` before running live Realtime tests.

## Useful Commands

```bash
npm run context
npm run standup
npm run voice
npm run check
```

## Safety Rules

- Do not add arbitrary shell execution from model output.
- Keep desktop actions allowlisted.
- Require confirmation for destructive or externally visible actions.
- Do not commit secrets, `.env`, recordings, or local logs.
