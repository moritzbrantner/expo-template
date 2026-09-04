# expo-template

Expo Router platform scaffold for auth, authz, social discovery, public profiles, and app-shell behavior backed by the local `auth-api` service.

## What this repo includes

- Expo Router public/app shell split with reusable auth and authenticated-app baselines
- local `auth-api` for sign-up, sign-in, sessions, profiles, follows, activity, and admin role updates
- Mailpit for local auth email smoke coverage
- persisted auth session storage
- persisted theme preference storage
- opt-in local fixture services kept separate from the scaffold contract

## Get started

Install dependencies and create the local environment file:

```bash
bun install
cp .env.example .env
```

Start the local auth stack and create or verify the starter account:

```bash
bun run dev:auth:up
```

Then start Expo in another terminal:

```bash
bun web
```

The tracked starter configuration is intentionally local-only. After copying `.env.example`, sign in with:

```text
Email:    admin@example.test
Password: expo-template-local
```

`dev:auth:up` is idempotent: it reuses the account when those credentials already work, creates it on a fresh auth volume, and fails instead of overwriting an existing account with different credentials.

To customize the starter identity, change the `AUTH_STARTER_*` values in `.env` before running `dev:auth:up`.

`EXPO_PUBLIC_AUTH_API_URL` is the URL used by the Expo client. `http://localhost:4401` works for web and the iOS simulator. For the Android emulator use `http://10.0.2.2:4401`; for a physical device use the development machine's reachable LAN address.

`AUTH_STARTER_API_URL` is separate and host-side only. Leave it at `http://localhost:4401` for the normal Docker Compose setup even when the Expo client needs an emulator or LAN URL.

Run the app without starting local services when you only need the client shell:

```bash
bun start
```

Stop the auth services while preserving the local account:

```bash
bun run dev:auth:down
```

If you intentionally need a clean auth store, remove the local Compose volume and bootstrap again:

```bash
docker compose down -v
bun run dev:auth:up
```

Rebuild the complete local service stack only when Dockerfiles or service dependencies change:

```bash
bun test:e2e:services:rebuild
```

Run the optional seeded fixture service:

```bash
bun dev:api:up
```

Stop that fixture service when finished:

```bash
bun dev:api:down
```

## Auth stack

The local auth stack includes:

- `auth-api`: lightweight Node service for auth and public user data
- `mailpit`: local SMTP inbox UI for signup emails

Docker Compose is the supported local runtime for `auth-api`. The non-E2E Bun test suite starts the
server in-process and does not require Docker.

Open Mailpit at `http://localhost:8825`.

The Expo app uses `auth-api` as the canonical scaffold backend:

- `Discover` calls the profile APIs through `EXPO_PUBLIC_AUTH_API_URL`
- `/u/[username]` resolves public profiles by username
- signed-up users become visible in the directory after account creation
- auth session state is restored from storage on reload
- authenticated app tabs stay behind the protected shell

Useful manual checks:

```bash
curl http://localhost:4401/health
curl http://localhost:4401/profiles
curl http://localhost:4401/profiles/<username>
```

Run the browser smoke/auth suite with:

```bash
bun test:e2e:services:up
bun test:e2e
```

## Optional dev fixture

`dev-api` is an explicitly separate seeded REST example served by
[`moritzbrantner/folder-server`](https://github.com/moritzbrantner/folder-server). It is not the
source of truth for scaffold users or auth state.

- `GET /profiles` returns seeded example profiles from `services/dev-api/data/profiles.json`
- `GET /profiles/alex` returns a seeded example profile by `username`
- `GET /healthz` is exposed for local health checks

## GitHub Pages app portfolio

`portfolio/apps.json` is the publishing registry for the mobile-app gallery. Every entry owns a
stable slug such as `calendar`, `timer`, or `nearby-history`. Treat a slug as a public URL contract
once published; evolve the app behind that route rather than renaming it casually.

The Pages build generates the root dashboard and one route per manifest entry. Entries without a
`source` directory receive a reserved planning page. Once an Expo app exists, add its repository-
relative directory as `source`; `scripts/build-pages.mjs` exports that app for web directly into its
stable route.

The current scaffold is registered as a working preview at `/scaffold/`. GitHub Pages production
builds inject `EXPO_PUBLIC_GITHUB_PAGES_BASE_URL` so Expo Router and bundled assets remain correct
when hosted below `/expo-template/<app>/`.

Build the complete Pages artifact locally with:

```bash
node scripts/build-pages.mjs
```

The generated site is written to `_site/` and is intentionally not committed.

## Validation

```bash
bun test
bun run test:unit
bun run test:integration
bun run lint
bunx tsc --noEmit
bun run build
bunx expo-doctor
bun run test:e2e
```

See [SCAFFOLD_ALIGNMENT.md](./SCAFFOLD_ALIGNMENT.md) for the repo's scaffold-family role and anti-drift contract.

See [MOBILE_APP_LANDSCAPE.md](./MOBILE_APP_LANDSCAPE.md) for the exploratory direction toward a shared monorepo of independently shippable mobile apps.
