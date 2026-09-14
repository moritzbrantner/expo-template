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

`create-app` does not maintain a second template. It calls this same Copier source, places the result under `apps/<slug>`, gives the workspace package an `@expo-template/<slug>` identity, registers it in the root Bun workspace, and refreshes the root lockfile. It refuses to overwrite an existing app.

## Portfolio presets

| `create-app` preset | Copier profile | Default navigation | Intended use |
| --- | --- | --- | --- |
| `utility` | `minimal` | stack | Small utilities that need the deterministic settings/localization baseline but no database |
| `standard` | `local-first` | tabs | Ordinary local-first portfolio apps that need SQLite persistence |

These are intentionally the only public portfolio presets for now. Do not add `native`, `rust`, or other convenience presets until at least two real consumers prove a stable capability boundary that the existing Copier profiles cannot express cleanly. Prefer an explicit Copier profile for exceptional apps rather than freezing speculative preset APIs.

## Copier profiles

| Profile | Included baseline |
| --- | --- |
| `minimal` | Settings-ready preferences and EN/DE/ES localization |
| `local-first` | Minimal plus SQLite persistence |
| `account-backed` | Minimal plus SecureStore, network awareness, and TanStack Query |
| `scheduled` | Local-first plus local notifications |

Choose the smallest profile that fits the product. The generated `app.features.ts` is the single source of truth for capability gates. App screens stay editable in the generated project; only stable primitives belong in shared platform packages.

Copier writes `.copier-answers.yml` into generated projects so template updates can be previewed and applied later with `copier update`.
