import type { ImagePickerAsset } from 'expo-image-picker';

import type { BabyClothingPhoto } from './clothing';
import { normalizeBabyClothingText } from './clothing';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export function babyClothingPhotoBaseName(entryId: string, photoId: string) {
  const normalized = `${normalizeBabyClothingText(entryId)}-${normalizeBabyClothingText(photoId)}`
    .toLocaleLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'baby-clothes-photo';
}

export function babyClothingPhotoExtension(
  asset: Pick<ImagePickerAsset, 'fileName' | 'mimeType'>,
) {
  const fileName = asset.fileName?.toLocaleLowerCase() ?? '';
  const match = fileName.match(/\.([a-z0-9]{2,5})$/);
  if (
    match?.[1] &&
    ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'avif', 'gif'].includes(match[1])
  ) {
    return match[1] === 'jpeg' ? 'jpg' : match[1];
  }
  return MIME_EXTENSIONS[asset.mimeType ?? ''] ?? 'jpg';
}

export function inlineBabyClothingPhoto(
  asset: Pick<ImagePickerAsset, 'base64' | 'mimeType'>,
  photoId: string,
  now = new Date(),
): BabyClothingPhoto {
  if (!asset.base64) {
    throw new Error('The selected web image did not include local image data.');
  }
  const mimeType = asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg';
  return {
    id: normalizeBabyClothingText(photoId),
    kind: 'inline-data',
    uri: `data:${mimeType};base64,${asset.base64}`,
    createdAt: now.toISOString(),
  };
}

/** Total inline photo payload the web catalog may keep in browser storage (~5 MiB quota). */
export const WEB_INLINE_PHOTO_BUDGET = 3_500_000;

export function inlinePhotoStorageSize(photos: Iterable<Pick<BabyClothingPhoto, 'kind' | 'uri'>>) {
  let total = 0;
  for (const photo of photos) {
    if (photo.kind === 'inline-data') {
      total += photo.uri.length;
    }
  }
  return total;
}
