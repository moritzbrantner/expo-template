# Mobile App Landscape

## Status

This document captures a product and architecture direction for evolving `expo-template` into the foundation for a larger landscape of independently shippable mobile applications. It is intentionally directional rather than a complete implementation contract.

The current standalone scaffold and its existing cross-repository alignment remain the current state until a dedicated migration changes them.

## Product vision

Build a broad family of useful mobile applications that solve immediate, ordinary problems well.

The first wave should deliberately include basic utilities people actively search for, for example:

- to-do list
- unit converter
- flashlight
- timer / stopwatch
- shopping list
- notes
- simple calculator
- gratitude journal
- keep-in-touch reminders
- borrow / lend tracker
- repair log

The portfolio can later expand into richer applications. A particularly promising flagship is a local-history guide that surfaces nearby stories about buildings, streets, churches, monasteries, rulers, traditions, and other historical places. More explicitly Christian sister products could focus on sacred places, pilgrimage, saints, and Christian history while sharing the same underlying geographic and historical infrastructure.

## Christian product principles

The applications may range from almost completely implicit to explicitly Christian, but the underlying product philosophy should be consistent.

The software should respect the person rather than optimize for extraction or engagement. In particular, prefer:

- no advertising by default
- no manipulative dark patterns
- no intentionally addictive engagement loops
- no obscenity or deliberately harmful content
- privacy and local ownership of data where practical
- truthful interfaces and pricing
- simple, calm interaction design
- easy export and user control
- no unnecessary accounts or tracking
- respect for rest, attention, family life, responsibility, charity, stewardship, and real-world relationships

An app should be allowed to succeed by helping the user leave the app and return to ordinary life.

## Degrees of explicitness

The landscape should support different degrees of Christian visibility without requiring every product to use the same presentation.

Possible levels:

1. **Implicit** — a humane, useful utility whose Christian provenance is mainly discoverable through project/about information.
2. **Identified** — clearly part of a Christian software family, while the product itself remains an ordinary utility.
3. **Integrated** — optional or product-specific concepts such as prayer, service, almsgiving, Sunday/rest rhythms, or Christian historical context.
4. **Explicit** — applications directly supporting Christian life, such as prayer, Scripture, catechesis, liturgical calendars, pilgrimage, or examination of conscience.

Avoid publishing near-identical store listings whose only meaningful difference is Christian branding. Variants should either be tested within a product or represent genuinely different products/curation.

## Repository direction

Do not create one repository per application.

The preferred target is a single main monorepo containing many independently shippable apps plus shared infrastructure:

```text
apps/
  flashlight/
  converter/
  tasks/
  nearby-history/
  ...

packages/
  app-shell/
  ui/
  storage/
  settings/
  privacy/
  localization/
  testing/
  ...

crates/
  history-core/
  geo-core/
  search-core/
  sync-core/
  ...

tooling/
  create-app/
  validate-app/
  release/
```

Each app remains an independent deployable product with its own package/bundle identifier, icon, store metadata, versioning, screenshots, privacy declaration, capabilities, and release target.

The monorepo should own one coherent dependency graph and avoid requiring future apps to copy and continuously synchronize a separate template repository.

## Relationship to the current Expo template

`expo-template` should be treated as the existing proven foundation rather than as an upstream repository that every future app must depend on.

A likely evolution is to move from "clone the template" toward:

- shared workspace packages as the actual reusable source of truth
- thin app directories
- deterministic app generation
- independently shippable app configurations
- affected-only validation and builds

The current cross-repository scaffold contract documented in `SCAFFOLD_ALIGNMENT.md` is existing architecture, not automatically part of this target. Before expanding the landscape, evaluate whether each cross-repository dependency still earns its coordination cost. Generic tooling may remain external, but shared runtime/app foundations should strongly prefer local workspace dependencies.

## App scaffolding

Adding app number 50 should not require an agent or developer to reconstruct the preferred Expo architecture manually.

A future deterministic generator could expose presets such as:

```bash
bun create-app flashlight --preset=utility
bun create-app tasks --preset=standard
bun create-app nearby-history --preset=rust
```

Possible presets:

- **utility** — Expo, TypeScript, shared UI/app shell, settings, privacy/about, tests
- **standard** — utility plus persistence and common device/application capabilities
- **native** — standard plus custom Expo/native modules
- **rust** — native plus the standardized Rust bridge

Presets should remain composable and minimal rather than becoming separate drifting templates.

## Technology direction

Use Expo / React Native / TypeScript as the default application and UI layer.

Rust is an optional shared engine, not a mandatory layer for every app. Prefer it when there is meaningful reusable domain logic, computation, parsing, indexing, search, sync, media/data processing, or other cross-platform infrastructure.

On mobile, prefer compiling Rust natively and bridging through platform adapters rather than introducing WASM as the default execution path.

Conceptually:

```text
React Native / TypeScript
        |
Expo/native module boundary
        |
Kotlin (Android) / Swift (iOS)
        |
shared Rust core when justified
```

Small utilities should remain small. A unit converter or flashlight does not need Rust merely because Rust is available.

## CI and dependency management

The monorepo should avoid rebuilding the whole application portfolio for every change.

Validation should operate on the affected dependency graph where possible:

- app-only change -> validate that app
- shared package change -> validate affected consumers
- Rust crate change -> validate affected Rust consumers/apps
- documentation-only change -> avoid application builds

The goal is to make the hundredth application cheaper to maintain than the tenth, rather than multiplying repository and pipeline overhead linearly.

## Near-term decisions intentionally deferred

This document does not yet decide:

- the final repository name or branding
- exact monorepo migration steps
- whether the current auth/social scaffold belongs in every app or becomes an optional capability
- exact generator implementation
- exact Rust FFI technology
- store-account and release-channel organization
- monetization/donation model
- detailed visual Christian symbolism
- the first exact batch of apps

Those should be decided in small implementation batches once the monorepo direction is actively pursued.
