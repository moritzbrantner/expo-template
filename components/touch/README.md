# Touch interaction layer

This directory contains reusable mobile interaction primitives for Expo/React Native. It deliberately separates interaction policy from application semantics.

## Rules

- Primary actions must have a visible/tappable or accessibility fallback. A hidden gesture may accelerate a workflow but must not be the only route to an important action.
- One finger manipulates content; two fingers manipulate the viewport when both behaviors are present.
- Visual controls may be compact, but the actual touch target must remain at least 44 points by default.
- Continuous controls preview while the finger moves and commit on release. Apps should not perform expensive domain work on every gesture frame unless explicitly required.
- Haptics are semantic: `tick`, `snap`, `boundary`, `success`, `warning`, and `reject`.
- Context UI should appear near the point of interaction and disappear when the interaction ends.
- Finger occlusion should be addressed with `TouchPreview`/`Magnifier` or `RemoteHandle` where precision matters.

## Components

### Thumb-first controls

- `RepeatButton`: tap-and-hold repeat with deterministic acceleration.
- `HoldAction`: deliberate hold activation.
- `StepControl`: large repeated +/- increments around a domain value.
- `SegmentedChoice`: large one-thumb mode switch.
- `SnapSlider` / `ThumbSlider`: snapping slider with preview/commit separation and haptic ticks.
- `DragHandle`: explicit reorder affordance.
- `BottomActionShelf`: contextual actions positioned at the bottom of a surface.
- `EdgeHandle`: visible edge affordance that supports tap and swipe.

### Motion and context

- `SwipeActions`: directional row actions plus a visible Actions fallback.
- `RadialMenu`: hold-drag-release radial selection plus visible buttons.
- `ReachOverlay`: places temporary actions away from the initiating finger.
- `FlickSurface`: velocity-sensitive shortcut with a visible fallback.
- `PrecisionScrubber`: horizontal value changes; vertical distance selects fine/normal/coarse precision.
- `DragSurface`: press-drag-release primitive with translation and velocity snapshots.
- `DragConfirm`: deliberate destructive/safety confirmation.

### One- and two-finger surfaces

- `ViewportSurface`: one finger manipulates content; two fingers pan/pinch/rotate the viewport.
- `PinchSurface`: pinch scaling with +/- fallback buttons.
- `GestureSelection`: two-finger selection frame, with an explicit single-finger selection mode button.
- `GestureUndo`: two-finger tap shortcut with a visible Undo button.

### Occlusion and precision

- `TouchPreview` / `Magnifier`: render an offset preview above the finger.
- `RemoteHandle`: control a target offset from the physical touch point.

The pure helpers in `lib/touch-interactions.ts` own snapping, repeat acceleration, radial selection, flick detection, precision scaling, selection geometry, and reach-aware placement so these semantics can be unit-tested without rendering React Native.
