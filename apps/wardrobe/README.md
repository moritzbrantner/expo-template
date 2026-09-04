# Wardrobe

A local-first Expo app for cataloguing clothes and exploring meaningful similarities between pieces you already own.

## MVP contract

- Keep clothing items on-device with name, category, color, materials, seasons, occasions, formality, fit, tags, and notes.
- Create, inspect, edit, and remove pieces without an account or backend.
- Search structured clothing evidence and filter the catalog deterministically.
- Rank the closest pieces with deterministic clothing-owned similarity evidence.
- Keep each contributing semantic channel inspectable instead of hiding the score behind a model.
- Treat missing optional metadata as unknown rather than automatically dissimilar.
- Do not add engagement loops, shopping feeds, or recommendation pressure.

Existing `items-v1` storage remains valid. Legacy entries hydrate with empty material/season/occasion evidence and unset formality/fit, then can be enriched incrementally through the normal edit flow.

## Semantic boundary

`apps/wardrobe/lib/semantic.ts` owns clothing-specific similarity policy only. It combines category, color, materials, seasons, occasions, formality, fit, tags, and name evidence into a bounded score and provides deterministic top-k presentation ordering.

Optional semantic channels enter the weighted score only when both compared pieces have evidence for that channel. The score is renormalized over the available evidence so an older sparsely catalogued item is not treated as dissimilar merely because a newer item has richer metadata.

The app deliberately does **not** implement a generic semantic graph, clustering, medoid selection, embedding provider, or vector store. `moenarch-semantic-core` owns domain-neutral neighbor/cluster structure in Foundation. A later JS/WASM or other repository-valid bridge can feed this app-owned similarity function into that shared structural layer without moving clothing policy downward or introducing an unpublished Rust dependency here.

## Repository boundary

`apps/wardrobe` is a portfolio source package rather than a root Bun workspace. It uses the repository's shared Expo dependency installation while remaining independently exportable through the portfolio Pages build.

## Local checks

```sh
bun run test
bun run typecheck
bun run build
```
