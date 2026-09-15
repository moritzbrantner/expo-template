# Copier generator contract

This repository remains a runnable reference app while `template/` is the source consumed by Copier.

Generate a standalone app directly with Copier:

```sh
copier copy gh:moritzbrantner/expo-template ./my-app
cd ./my-app
bun install
bun start
```

For apps that belong to this mobile portfolio, use the repository-owned `create-app` front end instead:

```sh
bun run create-app -- reading-list --name "Reading List" --preset utility
bun run create-app -- field-notes --name "Field Notes" --preset standard
```

`create-app` uses this same Copier source, places the result under `apps/<slug>`, assigns the workspace package an `@expo-template/<slug>` identity, registers it in the root Bun workspace, and refreshes the root lockfile. It refuses to overwrite an existing app.

The `Create App Contract` exercises both supported presets through this real entry point. It generates each fixture twice from the same exact template revision and requires identical app, workspace, and lockfile results; validates that generation writes only the requested app plus root workspace/lock state; runs lint, strict typecheck, tests, Expo Doctor, and web export with Expo network access disabled after dependencies are installed; verifies duplicate creation leaves the app, root package, and lockfile byte-for-byte unchanged; and runs an ordinary same-revision `copier update` from the generated provenance. The contract must be extended rather than bypassed when the supported generation path changes.

Generated apps own a canonical `build` command (`expo export --platform web`) and a pinned `expo-doctor` development dependency so their ordinary validation path does not depend on `bunx` downloading validation tooling at execution time.

## Portfolio presets

| `create-app` preset | Copier profile | Default navigation | Intended use |
| --- | --- | --- | --- |
| `utility` | `minimal` | stack | Small utilities using the deterministic settings/localization baseline without a database |
| `standard` | `local-first` | tabs | Ordinary local-first portfolio apps that need SQLite persistence |

These are intentionally the only public portfolio presets for now. Add further presets only after repeated real consumers prove a stable capability boundary that the existing Copier profiles cannot express cleanly.

## Copier profiles

| Profile | Included baseline |
| --- | --- |
| `minimal` | Settings-ready preferences and EN/DE/ES localization |
| `local-first` | Minimal plus SQLite persistence |
| `account-backed` | Minimal plus SecureStore, network awareness, and TanStack Query |
| `scheduled` | Local-first plus local notifications |

Choose the smallest profile that fits the product. The generated `app.features.ts` is the single source of truth for capability gates. App screens stay editable in the generated project; only stable primitives belong in shared platform packages.

Copier writes `.copier-answers.yml` into generated projects so template updates can be previewed and applied later with `copier update`.
