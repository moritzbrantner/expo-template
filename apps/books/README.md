# Books

A local-first Expo app for keeping a personal reading library.

## MVP contract

- Scan an ISBN-13/EAN-13 barcode with `expo-camera`, or enter ISBN-10/13 manually.
- Validate and canonicalize ISBNs before they enter the library.
- Enrich valid ISBNs with title, author, cover, publication year, and publisher metadata from Open Library.
- Keep the library and reading reflections on-device with AsyncStorage.
- Record reading status, notes/opinions, key ideas, and why the book mattered.
- Continue to work when metadata lookup is unavailable; online data is enrichment, not ownership of the library.

## Repository boundary

`apps/books` is a portfolio source package rather than a root Bun workspace. Portfolio builds use the repository's shared Expo dependency graph, which keeps `services/auth-api` as the existing isolated Bun workspace and preserves its frozen Docker install contract.

## Local checks

```sh
bun run test
bun run typecheck
bun run build
```
