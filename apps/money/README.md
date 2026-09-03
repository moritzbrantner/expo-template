# Money

A local-first single-currency personal ledger.

## MVP contract

- Record income and expenses as integer cents, never floating-point money.
- Categorize entries and add an optional note.
- Show overall balance plus current-month income and spending.
- Delete incorrect entries and persist the ledger locally with AsyncStorage.
- Use EUR as the first fixed ledger currency. No bank connection, budgeting engine, investment tracking, or exchange-rate conversion yet.

## Local checks

```sh
bun run test
bun run typecheck
bun run build
```
