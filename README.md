# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   bun install
   ```

2. Start the app

   ```bash
   bun start
   ```

For the auth flow on web, you can point the app at the local test API:

```bash
EXPO_PUBLIC_AUTH_API_URL=http://localhost:4401 bun web
```

For the example REST endpoint used in development and testing, start the folder-backed API and
point the app at it:

```bash
bun dev:api:up
EXPO_PUBLIC_DEV_API_URL=http://localhost:4402 bun web
```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
bun reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Auth e2e stack

The repository includes a local auth testing stack:

- `auth-api`: lightweight Node service for `/auth/signup` and `/auth/signin`
- `mailpit`: local SMTP + inbox UI used to capture signup emails

The Expo app persists the authenticated session with device storage, so a signed-in user stays authenticated across reloads until they sign out.

Start it manually with:

```bash
bun test:e2e:services:up
```

Open Mailpit at `http://localhost:8825`.

The same service now also exposes public user data for the mobile app:

```bash
curl http://localhost:4401/users
curl http://localhost:4401/users/<user-id>
```

The `Communication` tab in the Expo app calls `GET /users` through
`EXPO_PUBLIC_AUTH_API_URL`, so once you create a couple of accounts and sign in, the app can
render other users fetched from the server.

Run the browser e2e suite with:

```bash
bun test:e2e
```

Stop the local services with:

```bash
bun test:e2e:services:down
```

## Dev REST fixture

The repository also includes a read-only dev API served by
[`moritzbrantner/folder-server`](https://github.com/moritzbrantner/folder-server).

- `GET /profiles` returns seeded example profiles from `services/dev-api/data/profiles.json`
- `GET /profiles/alex` returns a single example profile using `username` as the primary key
- `GET /healthz` is exposed by `folder-server` for local health checks

Start the service with:

```bash
bun dev:api:up
```

Stop it with:

```bash
bun dev:api:down
```

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
