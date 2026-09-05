# Unit Converter

A fast, offline unit converter for common everyday measurements.

## MVP contract

- Convert length, mass, temperature, volume, and speed.
- Switch units without a network request or account.
- Swap source and target units while preserving the represented quantity.
- Keep conversion formulas in a pure TypeScript module with deterministic tests.
- Accept either `.` or `,` as the decimal separator for input.

## Boundaries

Currency is intentionally excluded because exchange rates are time-dependent and would violate the offline deterministic contract. Additional physical dimensions should be added only with explicit units and tests.

The store release lane must not add accounts, analytics, ads, or a network dependency to the converter itself.

## Local checks

```sh
bun install --frozen-lockfile
bun run verify
```

`bun run verify` runs the converter tests, typecheck, and web build.

## Store release canary

The converter has an immutable source-to-binary release lane, but permanent product/store identity is intentionally not invented in source control. `bun run release:preflight` remains fail-closed until the app owner supplies:

- a permanent iOS bundle identifier;
- a permanent Android package identifier;
- the linked Expo/EAS project ID;
- the App Store Connect application ID in both iOS submit profiles;
- configured EAS build and store submission credentials;
- HTTPS support and privacy-policy URLs;
- the repository `EXPO_TOKEN` Actions secret.

Once those values are configured, run the repository workflow **Converter Mobile Release** against an exact commit SHA with `submit_profile=internal` and `deliver=true`. The canary target is TestFlight plus Google Play internal testing only. Android production submission remains `draft`, and public App Store/Play exposure is outside the workflow.
