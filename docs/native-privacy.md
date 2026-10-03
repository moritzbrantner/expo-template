# Native privacy boundary

The canonical Expo template treats native permissions as a build-time contract, not as an incidental side effect of installed packages.

## Root app

The root account flow chooses an existing profile photo with `ImagePicker.launchImageLibraryAsync`. It does not capture a photo or record audio. The `expo-image-picker` config plugin therefore declares an explicit photo-library explanation and disables both camera and microphone permissions.

This is intentionally narrower than the package defaults. A future feature that genuinely needs camera or microphone access must change the app config and its privacy-contract test in the same pull request; installing or importing a package is not sufficient justification for broadening native permissions.

## Portfolio apps

Apps under `apps/` own their own native permission contracts. They should request only the capabilities their native implementation uses and should prefer granular media permissions where the platform supports them. Shared dependencies in the repository do not imply that every generated app should inherit the same permission set.

## Store/privacy evidence

Permission configuration is only one layer of store compliance. iOS required-reason APIs must be represented through Expo's `ios.privacyManifests` configuration when a native dependency actually requires them. Android permissions added transitively by native packages should be removed with `android.blockedPermissions` when they are not part of the app's declared capability boundary.

Store submission remains the authoritative integration check for platform-specific privacy-manifest requirements that cannot be established from source configuration alone. The template should record those results as evidence rather than inventing declarations for APIs it has not shown to use.
