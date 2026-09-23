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


## Product UI

- Treat functional app screens as tools, not landing pages. Put the primary task, content, search/filter controls, and frequent actions in the first viewport; do not lead with recurring hero slogans or marketing-style explanatory copy.
- Do not add KPI, count, or summary cards merely to make a screen look like a dashboard. A metric belongs on the screen only when it changes a decision or helps complete the current task.
- Every persistent navigation item, icon, and action must correspond to a real frequent destination or task. Remove placeholder/decorative icons and avoid duplicating page identity with redundant navigation chrome.
- Prefer compact, information-dense mobile layouts over decorative whitespace. Use explanatory copy only where it resolves ambiguity at the point of action; move implementation rationale and product manifestos to README/About surfaces.
- Empty states should state what is missing and the next useful action, not sell or explain the product.

## Acceptance

A change is ready only when its exact head satisfies the repository's required validation. Missing, skipped, or still-running checks are not evidence of success.
