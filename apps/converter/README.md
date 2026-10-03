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

## Store and direct release

Converter now uses the repository-wide mobile release contract. Its stable native identity is derived from `io.github.moritzbrantner.converter`; review that identifier before creating the first store record.

Product/store-owned setup remains fail-closed until the owner supplies:

- the linked Expo/EAS project ID;
- HTTPS support and privacy-policy URLs;
- reviewed listing assets and privacy/data declarations;
- EAS build/signing credentials;
- Google Play credentials when Android store delivery is enabled;
- the App Store Connect application ID and Apple credentials only when iOS delivery is enabled;
- the repository `EXPO_TOKEN` Actions secret for CI builds.

Use **Mobile App Release** to qualify an exact Converter source SHA for Android, iOS, or both. Android-only qualification does not require Apple setup. Use **Android Direct Build** for an exact-source signed APK that can be distributed without a Google Play account.

The Android production submit profile remains `draft`, and public App Store/Play exposure is outside the qualification workflow.
