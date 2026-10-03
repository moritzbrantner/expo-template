# Mobile store and direct distribution

The apps under `apps/` are independently shippable Expo products. Release configuration is deliberately split between committed structure and owner-controlled store credentials.

## What is already committed

Every current Expo app has:

- a stable native identifier derived from `io.github.moritzbrantner.<slug-without-hyphens>`;
- an exact EAS CLI/source policy;
- development, preview, production, and direct Android APK build profiles;
- internal and production submit profiles;
- per-app release metadata with explicit listing/privacy readiness gates;
- a shared release tool at `tooling/release/mobile-release.mjs`;
- exact-source qualification workflows for store binaries and direct Android APKs.

Review the native identifier before creating the first store record. Once an Android package or Apple bundle ID is used for a released app, changing it generally creates a different app identity.

## Owner setup required once per app

Before a remote EAS build, run `eas init` in the app directory and commit the generated `extra.eas.projectId`.

Before a store release, also:

1. fill `supportUrl` and `privacyUrl` in the app's `release.config.json`;
2. create/review the product-specific icon, screenshots, listing text, and privacy/data declarations;
3. set both `storeReadiness` flags to `true` only after those reviews are complete;
4. configure EAS build credentials;
5. configure the target store account and EAS Submit credentials.

Apple-only fields are checked only for iOS releases. Missing Apple credentials do not block Android qualification.

## Google Play

Use the Android-only path when an app is ready for Play without iOS:

```text
bun tooling/release/mobile-release.mjs preflight --app apps/tasks --platform android
bun tooling/release/mobile-release.mjs build --app apps/tasks --platform android
bun tooling/release/mobile-release.mjs submit --app apps/tasks --platform android --profile internal
```

Promote to `--profile production` only after internal testing. The production EAS submit profile intentionally creates a Play production draft rather than silently rolling it out.

The Google Play developer account and its service-account credentials remain external owner-controlled setup; they are never committed to this repository.

## Apple App Store

The same tooling supports iOS independently:

```text
bun tooling/release/mobile-release.mjs preflight --app apps/tasks --platform ios
bun tooling/release/mobile-release.mjs build --app apps/tasks --platform ios
bun tooling/release/mobile-release.mjs submit --app apps/tasks --platform ios --profile internal
```

A normal public App Store release requires Apple Developer Program membership. If the account does not qualify for Apple's fee waiver, the App Store is therefore not a zero-cost distribution channel. The existing GitHub Pages web builds remain the zero-store-account-cost iPhone/iPad-accessible option.

## Android without a store account

For an installable signed APK, use the direct profile:

```text
bun tooling/release/mobile-release.mjs preflight-direct --app apps/tasks
bun tooling/release/mobile-release.mjs direct-android --app apps/tasks
```

The `Android Direct Build` workflow performs the same exact-source build and preserves an attested APK artifact. This path does not require a Google Play account. Distribution can later use GitHub Releases, a project website, an internal channel, or another Android catalog that accepts externally built APKs.

F-Droid is a separate follow-up: its main repository expects reproducible/free-software source builds and should not be treated as merely another place to upload the EAS APK.

## CI workflows

`Mobile App Release` qualifies one selected app on Android, iOS, or both and preserves the exact produced store binaries through the shared qualification/promotion pipeline.

`Android Direct Build` does the same for a signed installable APK.

Store submission remains an explicit terminal action. `mobile-release.mjs submit` reads the qualified `mobile-release.json` and submits the exact EAS build IDs recorded there rather than relying on a mutable "latest build" lookup.
