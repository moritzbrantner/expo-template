# Agent guidance

Keep changes aligned with the repository's Expo/React Native TypeScript architecture and existing workspace boundaries.

## Validation

Use `.coding-tooling.json` as the executable validation contract. For normal changes, run the declared fast capabilities (`lint`, `typecheck`, `build`, and `test:unit`) and add integration or end-to-end evidence when the changed surface requires it. Do not weaken or bypass a failing capability to make a change pass.

## Boundaries

- Keep reusable behavior in the existing shared/package seams instead of duplicating it inside individual apps.
- Preserve Expo Router and platform behavior across Android, iOS, and web unless a change is intentionally platform-specific.
- Keep generated files and dependency state reproducible; update lockfiles together with dependency changes.
- Prefer small, independently verifiable changes over broad refactors.
- Treat user data and permissions conservatively. Do not add tracking, advertising, or unnecessary data collection.

## Acceptance

A change is ready only when its exact head satisfies the repository's required validation. Missing, skipped, or still-running checks are not evidence of success.
