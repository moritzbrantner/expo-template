# scaffold-v2 reconciliation audit

This audit classifies the current uncommitted work before contract alignment. Nothing in the dirty tree should be reverted by default.

## Reusable platform work to keep

- The route split from legacy `app/auth/*` and `app/(tabs)/*` into `app/(public)/*` and `app/(app)/*`, including the new auth shell in `app/_layout.tsx`.
- The in-progress auth, authz, and social baseline across `lib/auth.ts`, `lib/auth-storage.ts`, `lib/authz.tsx`, `lib/social-hooks.ts`, `providers/auth-provider.tsx`, `components/social/*`, and the auth-api service changes under `services/auth-api/*`.
- The current Playwright auth and social scenarios in `e2e/example.spec.ts` as the basis for a renamed smoke/auth contract suite.
- The expanded unit and integration coverage in `tests/unit.test.ts` and `tests/integration.test.ts` that validates the new public/app shell and auth-api behavior.

## Repo-local implementation detail to keep

- Local service bootstrap changes in `docker-compose.yml`, `services/auth-api/Dockerfile`, and `services/auth-api/server.ts` that support the repo's scaffold smoke environment.
- The ESLint config migration from `eslint.config.ts` to `eslint.config.js` and the package script update that make the standalone repo runnable on current tooling.

## Stale contract, docs, or tests to replace

- `app.manifest.ts` in its current incomplete form because `scaffold-v2` requires `entryWorkspace` and `sharedPackages` plus the full standalone manifest contract.
- `e2e/example.spec.ts` naming and any remaining starter copy that still reads like a generic example instead of an explicit scaffold smoke/auth contract.
- Any route, doc, or validation language that still implies the deleted stock Expo starter layout or product-specific flows rather than a reusable platform baseline.
