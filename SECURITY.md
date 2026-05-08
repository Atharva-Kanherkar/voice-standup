# Security

Voice Standup is local-first, but it still touches sensitive context:

- local git status and recent commits
- lightweight project docs
- GitHub public/account events through `gh`
- microphone input when `npm run voice` is used

## Reporting

Open a private GitHub security advisory if available, or contact the maintainer through GitHub.

## Design Principles

- API keys stay in `.env` or the caller's shell environment.
- `.env` is ignored by git.
- Model output must not be treated as executable shell.
- Desktop actions should be allowlisted and confirmed when risky.
