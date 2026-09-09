# Notes

Plain, local-first notes with a calm editing flow and no account requirement.

## MVP contract

- Create, edit, and delete plain-text notes.
- Allow an optional title and derive one from the first body line when omitted.
- Keep recently edited notes first.
- Persist notes locally with AsyncStorage.
- Require no account, network connection, analytics, or engagement loop.

Rich text, sync, attachments, and export are deliberately deferred; portability should be added explicitly rather than by silently introducing cloud ownership.

## Local checks

```sh
bun run test
bun run typecheck
bun run build
```
