# Photos

A privacy-first Expo photo album that indexes the device photo library without copying original files and groups recurring people with face embeddings computed on-device.

## MVP

- index the newest 200 device photos by system-library asset ID and URI
- timeline-style library grouped by month
- YuNet face detection on the device
- SFace embeddings and conservative cosine-similarity clustering on the device
- unnamed people clusters with manual naming
- manual merge and split corrections for imperfect clustering
- app-managed albums that store references to system-library photos rather than duplicates
- local persistence for metadata, embeddings, names, corrections, and albums
- a deterministic web preview using synthetic labelled photos; the browser preview never pretends to run native face inference

## Privacy boundary

Photo originals remain owned by the system photo library. The app stores only local references, face boxes, embeddings, cluster metadata, names, and album membership. Native inference is performed with ONNX Runtime inside the app process. No photo pixels or embeddings are sent to an application backend.

The first native people scan downloads two model files into the application cache: OpenCV Zoo's YuNet detector and the compact int8 SFace recognition model. Those network requests fetch model weights only. Temporary resized JPEGs used for analysis also live in the app cache and may be cleared by the operating system.

People grouping is similarity clustering, not automatic identity lookup. Names are always entered by the user.

## Native model boundary

The native implementation lives behind `lib/ml.native.ts`; the portfolio browser preview uses `lib/ml.web.ts`. `lib/device.native.ts` owns the system media-library query while `lib/device.web.ts` supplies synthetic preview assets. This keeps the UI and domain model independent from the inference provider.

The detector implements the YuNet score, box, landmark, and NMS decoding used by OpenCV. Detected five-point landmarks are aligned to the standard SFace 112×112 template before generating a normalized 128-dimensional embedding. New embeddings are assigned to the nearest current centroid only when cosine similarity clears the conservative `0.42` threshold; otherwise a new unnamed cluster is created.

## Running natively

`onnxruntime-react-native` contains native code, so people detection requires a development/native build rather than Expo Go.

```bash
bun install
cd apps/photos
bun expo prebuild
bun expo run:android
# or: bun expo run:ios
```

Grant photo access and choose **Scan**. The current MVP processes new photos sequentially in the foreground and considers the newest 200 images per scan. Already indexed asset IDs are skipped on subsequent scans.

## Web preview

```bash
cd apps/photos
bun expo start --web
```

The web build intentionally uses synthetic SVG images plus deterministic demo embeddings so GitHub Pages can exercise the timeline, people naming/merge/split interactions, and albums without browser photo-library or native ONNX access.

## Checks

```bash
cd apps/photos
bun test
bun run typecheck
bun run build
```

## Model attribution

The native implementation downloads the MIT-licensed OpenCV Zoo models:

- YuNet: `face_detection_yunet_2023mar.onnx`
- SFace: `face_recognition_sface_2021dec_int8.onnx`

The files are fetched from the OpenCV model repositories on Hugging Face at runtime and are not committed to this repository.
