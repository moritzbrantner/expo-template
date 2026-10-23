import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import {
  suggestBabyClothingColorFromPixels,
  type BabyClothingColorSuggestion,
} from './assistance';

const ANALYSIS_SIZE = 96;

export async function analyseBabyClothingPhotoColor(
  uri: string,
): Promise<BabyClothingColorSuggestion | null> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: ANALYSIS_SIZE, height: ANALYSIS_SIZE });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.9,
  });

  const derivative = new File(result.uri);
  try {
    const bytes = await derivative.bytes();
    const decoded = decode(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 1,
      maxMemoryUsageInMB: 16,
    });

    return suggestBabyClothingColorFromPixels(
      decoded.data as Uint8Array,
      decoded.width,
      decoded.height,
    );
  } finally {
    // The downscaled analysis copy is user image data; do not leave it in the cache.
    try {
      if (derivative.exists) {
        derivative.delete();
      }
    } catch {
      // Best effort: the OS evicts cache files eventually.
    }
  }
}
