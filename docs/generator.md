# Copier generator contract

This repository remains a runnable reference app while `template/` is the source consumed by Copier.

Generate an app:

```sh
copier copy gh:moritzbrantner/expo-template ./my-app
cd ./my-app
bun install
bun start
```

## Profiles

| Profile | Included baseline |
| --- | --- |
| `minimal` | Settings-ready preferences and EN/DE/ES localization |
| `local-first` | Minimal plus SQLite persistence |
| `account-backed` | Minimal plus SecureStore, network awareness, and TanStack Query |
| `scheduled` | Local-first plus local notifications |

Choose the smallest profile that fits the product. The generated `app.features.ts` is the single source of truth for capability gates. App screens stay editable in the generated project; only stable primitives belong in shared platform packages.

Copier writes `.copier-answers.yml` into generated projects so template updates can be previewed and applied later with `copier update`.
