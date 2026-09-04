import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import * as ort from 'onnxruntime-react-native';

import type { FaceAnalysis, PhotoAsset } from './types';

const DETECTOR_SIZE = 640;
const EMBEDDER_SIZE = 112;
const DETECTION_THRESHOLD = 0.75;
const NMS_THRESHOLD = 0.3;

const DETECTOR_URL =
  'https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx';
const EMBEDDER_URL =
  'https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec_int8.onnx';

type Point = { x: number; y: number };
type Detection = {
  x: number;
  y: number;
  width: number;
  height: number;
  landmarks: [Point, Point, Point, Point, Point];
  score: number;
};

type RawImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

let detectorSession: Promise<ort.InferenceSession> | null = null;
let embedderSession: Promise<ort.InferenceSession> | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function cachedModel(filename: string, url: string) {
  const directory = new Directory(Paths.cache, 'photo-people-models');
  directory.create({ idempotent: true, intermediates: true });

  const file = new File(directory, filename);
  if (!file.exists) {
    await File.downloadFileAsync(url, file);
  }
  return file.uri;
}

function sessions() {
  detectorSession ??= cachedModel('yunet-2023mar.onnx', DETECTOR_URL).then((uri) =>
    ort.InferenceSession.create(uri),
  );
  embedderSession ??= cachedModel('sface-2021dec-int8.onnx', EMBEDDER_URL).then((uri) =>
    ort.InferenceSession.create(uri),
  );
  return { detectorSession, embedderSession };
}

async function normalizedImage(uri: string): Promise<RawImage> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: DETECTOR_SIZE, height: DETECTOR_SIZE });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.94,
  });

  const bytes = await new File(result.uri).bytes();
  const decoded = decode(bytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: 2,
    maxMemoryUsageInMB: 64,
  });

  if (decoded.width !== DETECTOR_SIZE || decoded.height !== DETECTOR_SIZE) {
    throw new Error(`Unexpected analysis image size ${decoded.width}x${decoded.height}`);
  }

  return {
    width: decoded.width,
    height: decoded.height,
    data: decoded.data as Uint8Array,
  };
}

function detectorInput(image: RawImage) {
  const plane = image.width * image.height;
  const input = new Float32Array(plane * 3);

  for (let index = 0; index < plane; index += 1) {
    const pixel = index * 4;
    input[index] = image.data[pixel + 2];
    input[plane + index] = image.data[pixel + 1];
    input[plane * 2 + index] = image.data[pixel];
  }

  return new ort.Tensor('float32', input, [1, 3, image.height, image.width]);
}

function iou(left: Detection, right: Detection) {
  const x1 = Math.max(left.x, right.x);
  const y1 = Math.max(left.y, right.y);
  const x2 = Math.min(left.x + left.width, right.x + right.width);
  const y2 = Math.min(left.y + left.height, right.y + right.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = left.width * left.height + right.width * right.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function nms(detections: Detection[]) {
  const candidates = [...detections].sort(
    (left, right) => right.score - left.score || left.x - right.x || left.y - right.y,
  );
  const kept: Detection[] = [];

  while (candidates.length > 0) {
    const next = candidates.shift();
    if (!next) {
      break;
    }
    kept.push(next);
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      if (iou(next, candidates[index]) >= NMS_THRESHOLD) {
        candidates.splice(index, 1);
      }
    }
  }

  return kept;
}

type InferenceOutputs = Record<string, { data: ArrayLike<number> }>;

function tensorData(outputs: InferenceOutputs, name: string): Float32Array {
  const value = outputs[name];
  if (!value) {
    throw new Error(`YuNet output ${name} is missing`);
  }
  return Float32Array.from(value.data);
}

function decodeYuNet(outputs: InferenceOutputs) {
  const detections: Detection[] = [];

  for (const stride of [8, 16, 32] as const) {
    const cls = tensorData(outputs, `cls_${stride}`);
    const obj = tensorData(outputs, `obj_${stride}`);
    const bbox = tensorData(outputs, `bbox_${stride}`);
    const kps = tensorData(outputs, `kps_${stride}`);
    const cols = DETECTOR_SIZE / stride;
    const rows = DETECTOR_SIZE / stride;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < cols; column += 1) {
        const index = row * cols + column;
        const clsScore = clamp(cls[index], 0, 1);
        const objScore = clamp(obj[index], 0, 1);
        const score = Math.sqrt(clsScore * objScore);
        if (score < DETECTION_THRESHOLD) {
          continue;
        }

        const cx = (column + bbox[index * 4]) * stride;
        const cy = (row + bbox[index * 4 + 1]) * stride;
        const width = Math.exp(bbox[index * 4 + 2]) * stride;
        const height = Math.exp(bbox[index * 4 + 3]) * stride;
        const landmarks = Array.from({ length: 5 }, (_, landmarkIndex) => ({
          x: (kps[index * 10 + landmarkIndex * 2] + column) * stride,
          y: (kps[index * 10 + landmarkIndex * 2 + 1] + row) * stride,
        })) as Detection['landmarks'];

        detections.push({
          x: cx - width / 2,
          y: cy - height / 2,
          width,
          height,
          landmarks,
          score,
        });
      }
    }
  }

  return nms(detections);
}

async function detectFaces(image: RawImage) {
  const { detectorSession: sessionPromise } = sessions();
  const session = await sessionPromise;
  const inputName = session.inputNames[0];
  const outputs = await session.run({ [inputName]: detectorInput(image) });
  return decodeYuNet(outputs as unknown as InferenceOutputs);
}

const TEMPLATE: [Point, Point, Point, Point, Point] = [
  { x: 38.2946, y: 51.6963 },
  { x: 73.5318, y: 51.5014 },
  { x: 56.0252, y: 71.7366 },
  { x: 41.5493, y: 92.3655 },
  { x: 70.7299, y: 92.2041 },
];

function similarityTransform(source: readonly Point[], target: readonly Point[]) {
  const sourceMean = source.reduce(
    (mean, point) => ({
      x: mean.x + point.x / source.length,
      y: mean.y + point.y / source.length,
    }),
    { x: 0, y: 0 },
  );
  const targetMean = target.reduce(
    (mean, point) => ({
      x: mean.x + point.x / target.length,
      y: mean.y + point.y / target.length,
    }),
    { x: 0, y: 0 },
  );

  let denominator = 0;
  let aNumerator = 0;
  let bNumerator = 0;

  source.forEach((point, index) => {
    const sx = point.x - sourceMean.x;
    const sy = point.y - sourceMean.y;
    const tx = target[index].x - targetMean.x;
    const ty = target[index].y - targetMean.y;
    denominator += sx * sx + sy * sy;
    aNumerator += sx * tx + sy * ty;
    bNumerator += sx * ty - sy * tx;
  });

  if (denominator <= Number.EPSILON) {
    throw new Error('Face landmarks cannot define a stable transform');
  }

  const a = aNumerator / denominator;
  const b = bNumerator / denominator;
  const tx = targetMean.x - a * sourceMean.x + b * sourceMean.y;
  const ty = targetMean.y - b * sourceMean.x - a * sourceMean.y;
  return { a, b, tx, ty };
}

function sample(image: RawImage, x: number, y: number, channel: number) {
  if (x < 0 || y < 0 || x > image.width - 1 || y > image.height - 1) {
    return 0;
  }
  const x0 = clamp(Math.floor(x), 0, image.width - 1);
  const y0 = clamp(Math.floor(y), 0, image.height - 1);
  const x1 = clamp(x0 + 1, 0, image.width - 1);
  const y1 = clamp(y0 + 1, 0, image.height - 1);
  const dx = clamp(x - x0, 0, 1);
  const dy = clamp(y - y0, 0, 1);

  const value = (px: number, py: number) => image.data[(py * image.width + px) * 4 + channel];
  const top = value(x0, y0) * (1 - dx) + value(x1, y0) * dx;
  const bottom = value(x0, y1) * (1 - dx) + value(x1, y1) * dx;
  return top * (1 - dy) + bottom * dy;
}

function alignedFaceTensor(image: RawImage, landmarks: Detection['landmarks']) {
  const transform = similarityTransform(landmarks, TEMPLATE);
  const determinant = transform.a * transform.a + transform.b * transform.b;
  const plane = EMBEDDER_SIZE * EMBEDDER_SIZE;
  const data = new Float32Array(plane * 3);

  for (let y = 0; y < EMBEDDER_SIZE; y += 1) {
    for (let x = 0; x < EMBEDDER_SIZE; x += 1) {
      const dx = x - transform.tx;
      const dy = y - transform.ty;
      const sourceX = (transform.a * dx + transform.b * dy) / determinant;
      const sourceY = (-transform.b * dx + transform.a * dy) / determinant;
      const index = y * EMBEDDER_SIZE + x;
      data[index] = sample(image, sourceX, sourceY, 0);
      data[plane + index] = sample(image, sourceX, sourceY, 1);
      data[plane * 2 + index] = sample(image, sourceX, sourceY, 2);
    }
  }

  return new ort.Tensor('float32', data, [1, 3, EMBEDDER_SIZE, EMBEDDER_SIZE]);
}

function normalizeEmbedding(data: readonly number[]) {
  const length = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(length) || length === 0) {
    return Array.from(data);
  }
  return Array.from(data, (value) => value / length);
}

async function embedFace(image: RawImage, detection: Detection) {
  const { embedderSession: sessionPromise } = sessions();
  const session = await sessionPromise;
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const outputs = await session.run({ [inputName]: alignedFaceTensor(image, detection.landmarks) });
  const output = outputs[outputName];
  if (!output) {
    throw new Error('SFace output is missing');
  }
  return normalizeEmbedding(Array.from(output.data as ArrayLike<number>));
}

export async function analysePhoto(photo: PhotoAsset): Promise<FaceAnalysis[]> {
  const image = await normalizedImage(photo.uri);
  const detections = await detectFaces(image);

  return Promise.all(
    detections.map(async (detection) => ({
      box: (() => {
        const x = clamp(detection.x / DETECTOR_SIZE, 0, 1);
        const y = clamp(detection.y / DETECTOR_SIZE, 0, 1);
        return {
          x,
          y,
          width: clamp(detection.width / DETECTOR_SIZE, 0, 1 - x),
          height: clamp(detection.height / DETECTOR_SIZE, 0, 1 - y),
        };
      })(),
      score: detection.score,
      embedding: await embedFace(image, detection),
    })),
  );
}
