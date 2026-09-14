# Shopping List

A deliberately small, local-first shopping list for groceries and ordinary household errands.

## MVP contract

- Add an item with an optional quantity or short qualifier.
- Mark items purchased without deleting them immediately.
- Keep active items ahead of purchased items.
- Clear purchased items only through an explicit action.
- Persist the list locally with AsyncStorage.
- Require no account, network connection, analytics, or engagement loop.

The MVP intentionally omits sharing, sync, store-specific aisles, recommendations, and shopping feeds.

## Local checks

```sh
bun run test
bun run typecheck
bun run build
```
