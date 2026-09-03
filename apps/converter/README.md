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

## Local checks

```sh
bun run test
bun run typecheck
bun run build
```
