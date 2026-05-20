# expo-template Agent Instructions

## Docker And Codex/T3 Cleanup

This project uses Docker services for local development or tests: `dev-api mailpit`.

Standard commands:

- `services:up`: start persistent local development services.
- `services:down`: stop persistent local development services without deleting volumes.
- `services:clean`: remove compose services, orphans, and disposable volumes.
- `services:ps`: show compose service state.
- `test:with-services`: run Docker-dependent tests through trap-based cleanup.
- `check:hygiene`: print git status, upstream/ahead-behind, and Docker state.

Codex/T3 rules:

- Run `git status --short` before editing and before the final response.
- Preserve unrelated dirty files; do not mix them into commits.
- Prefer `test:with-services` for tests that need Docker.
- Do not run raw `docker compose up` for tests unless you also add trap-based cleanup.
- Before finalizing Docker-sensitive work, run `services:ps` or `docker compose ps` and report remaining containers.
- Use `services:down` after dev sessions. Use `services:clean` only when deleting disposable test data is acceptable.
- Format touched files only unless the task explicitly asks for a repo-wide format.

