# Wardrobe

A local-first Expo app for cataloguing clothes and exploring meaningful similarities between pieces you already own.

## MVP contract

- Keep clothing items on-device with name, category, color, tags, and notes.
- Create, inspect, edit, and remove pieces without an account or backend.
- Search and filter the catalog deterministically.
- Rank the closest pieces with deterministic clothing-owned similarity evidence.
- Keep category, color, tag, and name contributions inspectable instead of hiding the score behind a model.
- Do not add engagement loops, shopping feeds, or recommendation pressure.

## Semantic boundary

`apps/wardrobe/lib/semantic.ts` owns clothing-specific similarity policy only. It combines category, color, tags, and name evidence into a bounded score and provides deterministic top-k presentation ordering.

It deliberately does **not** implement a generic semantic graph, clustering, medoid selection, embedding provider, or vector store. `moenarch-semantic-core` now owns domain-neutral neighbor/cluster structure in Foundation. A later JS/WASM or other repository-valid bridge can feed this app-owned similarity function into that shared structural layer without moving clothing policy downward or introducing an unpublished Rust dependency here.

## Repository boundary

`apps/wardrobe` is a portfolio source package rather than a root Bun workspace. It uses the repository's shared Expo dependency installation while remaining independently exportable through the portfolio Pages build.

## Local checks

```sh
bun run test
bun run typecheck
bun run build
```
