# Baby Clothes

A private local-first Expo app for cataloguing baby clothes by photo, color, printed size, normalized size range, quantity, and lifecycle state.

## MVP contract

- Track either one specific garment or a group of identical garments.
- Keep the printed/original size label exactly as entered while also storing an optional normalized centimetre range for sorting and filtering.
- Attach multiple photos from the camera or photo library; photos remain on-device.
- Keep a user-confirmed color alongside the garment rather than treating visual analysis as authority.
- Track baby-clothing lifecycle states: too large, in use, dirty, stored, too small, and donated/sold.
- Filter the wardrobe by text, lifecycle state, and normalized size range.
- Keep all inventory data local with no account or backend dependency.
- Do not add shopping feeds, engagement counters, or recommendation pressure.

## Assisted metadata boundary

Metadata assistance is deliberately advisory.

- Native builds can inspect local photo pixels and suggest one coarse color such as blue, beige, pink, or gray. The suggestion is deterministic, stays on-device, and is never applied unless the user taps the explicit **Use** action.
- Printed labels such as `50/56`, `62`, `0–3M`, or `6–9 months` can produce a normalized centimetre-range suggestion. The original printed label remains untouched. Month-based conversions are explicitly presented as rough, brand-dependent guidance.
- The web preview keeps manual color entry and size-label suggestions but does not pretend that browser photo analysis is the native workflow.

This slice does **not** guess garment category or brand, and it does not run OCR. Adding a weak generic classifier or uploading family photos to a recognition backend would be a worse boundary than leaving those fields manual. A later on-device recognizer can extend the same user-confirmed suggestion contract when there is trustworthy evidence for it.

## Product boundary

This app is intentionally separate from `apps/wardrobe`. The general Wardrobe app owns adult/general clothing semantics such as similarity and outfit compatibility. Baby Clothes owns baby-specific grouped quantities, printed-vs-normalized sizing, and lifecycle state.

Wardrobe-gap planning is still deferred. The current model creates the reliable inventory and lifecycle evidence that a later “what size is needed next?” view can query without inventing data.

## Privacy boundary

Native builds request camera permission only when the user chooses **Take photo**, and photo-library permission only when the user chooses **Choose photo**. Microphone access is disabled. Photo color assistance runs against a small local derivative of the selected image and does not upload the photo, call a recognition service, or download a model.

## Local checks

```sh
bun --cwd apps/baby-clothes test
bun --cwd apps/baby-clothes typecheck
bun --cwd apps/baby-clothes build
```
