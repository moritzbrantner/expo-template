# SCAFFOLD_ALIGNMENT.md

## Canonical source

The normative scaffold contract lives in `monorepo/SCAFFOLD_V2.md`.

## Repo role

`expo-template` is the maintained standalone mobile scaffold in the `next-expo-electron` family.

## What is local vs shared

Local:
- Expo Router app shell
- mobile auth/authz and social profile flows
- local auth-api service and Docker-based dev stack

Shared:
- scaffold contract from `monorepo`
- pinned reusable workflow references
- structural migrations from `@moritzbrantner/platform-upgrader`

## Update path

1. Land contract changes in `monorepo`.
2. Publish shared workflow changes when needed.
3. Apply structural changes with `bunx @moritzbrantner/platform-upgrader apply scaffold-v2`.
4. Keep mobile-specific product work local to this repo.

## What must not drift

- root `app.manifest.ts`
- `.platform-upgrader.json`
- smoke/auth e2e suite naming
- pinned reusable workflow refs
- standalone repo layout with `(public)` and `(app)` shells

## Config references

- `.platform-upgrader.json`
- `app.manifest.ts`
- `scaffold-v2-reconciliation-audit.md`

