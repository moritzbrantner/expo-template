# Books

A local-first Expo app for keeping a personal reading library without storing the contents of the books themselves.

## MVP contract

- Scan an ISBN-13/EAN-13 barcode with `expo-camera`, or enter ISBN-10/13 manually.
- Validate and canonicalize ISBNs before they enter the library.
- Enrich valid ISBNs with title, author, cover, publication year, and publisher metadata from Open Library.
- Keep the library and personal writing on-device with AsyncStorage.
- Record reading status and completion date.
- Keep quick notes, a considered review, key ideas, and why the book mattered as distinct user-authored fields.
- Search locally across book metadata and personal annotations.
- Continue to work when metadata lookup is unavailable; online data is enrichment, not ownership of the library.
- Store book metadata and user-authored annotations only. Do not download or retain ebook/full-text content.

## Repository boundary

`apps/books` is a portfolio source package rather than a root Bun workspace. Portfolio builds use the repository's shared Expo dependency graph, which keeps `services/auth-api` as the existing isolated Bun workspace and preserves its frozen Docker install contract.

## Local checks

```sh
bun run test
bun run typecheck
bun run build
```
