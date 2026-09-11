# Nearby History

`apps/nearby-history` is the Horizon 1 field prototype for spatial historical reconstruction.

The goal of this horizon is deliberately narrow: prove that a reconstruction can be manually registered to a known real-world viewpoint, remain world-locked while the visitor moves the phone, and blend between the live camera view and the historical overlay.

## What Horizon 1 proves

- one known site at a time
- a predefined physical viewing point and viewing direction
- native AR world tracking through ViroReact / ARKit / ARCore
- a manually calibrated reconstruction transform (`position`, `rotation`, `scale`)
- a present ↔ past opacity control
- an explicit tracking-quality state in the UI
- a deterministic GitHub Pages preview that exercises the same setup and blend flow without pretending browser AR is native AR

## Historical-content boundary

The committed reconstruction is intentionally a procedural calibration façade, not a claim about how any real historical building looked.

`lib/site.ts` labels the fixture as `technical-demo`. A sourced building and model can replace that fixture only after the site, period, source evidence, and reconstruction provenance are known. This keeps the AR experiment from manufacturing historical evidence.

The historical-source-atlas integration is also intentionally deferred. Its evidence-first model should later provide the site/reconstruction/provenance read boundary; this Horizon 1 package owns only the mobile field experience.

## Native AR

ViroReact contains native code and does not run in Expo Go. Install this app's native-only dependency locally, generate the native project, and run a development build:

```bash
cd apps/nearby-history
bun install
bun expo prebuild --clean
bun expo run:ios
# or
bun expo run:android
```

The Expo config includes the Viro config plugin only for native builds. GitHub Pages exports set `EXPO_PUBLIC_GITHUB_PAGES_BASE_URL`, which keeps that native plugin out of the browser build.

## Field calibration

For the first real site:

1. Select one building and one sourced reconstruction period.
2. Mark a repeatable visitor position and the direction the visitor should face.
3. Replace the procedural fixture with the sourced model.
4. Tune `HORIZON_ONE_SITE.calibration.position`, `.rotation`, and `.scale` from that viewing point.
5. Re-launch from the same point and confirm the reconstruction remains visually locked while the phone translates and rotates within the intended viewing area.
6. Record the accepted calibration values as site data rather than adding image recognition to compensate for a bad manual registration.

## Web preview

```bash
cd apps/nearby-history
bun expo start --web
```

The browser renders a deterministic façade/composite preview. It validates the setup flow, disclosure, tracking-state presentation, and present ↔ past control. It does not access a camera and does not claim to validate AR registration.

## Checks

```bash
cd apps/nearby-history
bun test
bun run typecheck
bun run build
```

The repository GitHub Pages build will publish the source package behind the existing stable `/nearby-history/` portfolio route.

## Horizon boundary

Not part of Horizon 1:

- arbitrary building detection
- GPS candidate ranking
- geospatial/VPS anchors
- façade feature matching
- automatic pose refinement
- depth or Streetscape occlusion
- multiple sites or time periods
- automatic reconstruction confidence

Those belong to Horizon 2 or later. Horizon 2 should start only after one real-site field test demonstrates that the manual registration and blend experience is worth automating.
