# Baby Clothes

A private local-first Expo app for cataloguing baby clothes by photo, printed size, normalized size range, quantity, and lifecycle state.

## MVP contract

- Track either one specific garment or a group of identical garments.
- Keep the printed/original size label exactly as entered while also storing an optional normalized centimetre range for sorting and filtering.
- Attach multiple photos from the camera or photo library; photos remain on-device.
- Track baby-clothing lifecycle states: too large, in use, dirty, stored, too small, and donated/sold.
- Filter the wardrobe by text, lifecycle state, and normalized size range.
- Keep all inventory data local with no account or backend dependency.
- Do not add shopping feeds, engagement counters, or recommendation pressure.

## Product boundary

This app is intentionally separate from `apps/wardrobe`. The general Wardrobe app owns adult/general clothing semantics such as similarity and outfit compatibility. Baby Clothes owns baby-specific grouped quantities, printed-vs-normalized sizing, and lifecycle state.

Photo recognition is not part of this first slice. A later opt-in recognizer may suggest category, color, brand, or size from a photo, but suggestions must remain user-confirmed evidence and must never silently overwrite stored clothing data.

Wardrobe-gap planning is also deferred. The current model creates the reliable inventory and lifecycle evidence that a later “what size is needed next?” view can query without inventing data.

## Privacy boundary

Native builds request camera permission only when the user chooses **Take photo**, and photo-library permission only when the user chooses **Choose photo**. Microphone access is disabled. Web preview supports choosing local images but does not pretend to provide the native camera workflow.

## Local checks

```sh
bun --cwd apps/baby-clothes test
bun --cwd apps/baby-clothes typecheck
bun --cwd apps/baby-clothes build
```
