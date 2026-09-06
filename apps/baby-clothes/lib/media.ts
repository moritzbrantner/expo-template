import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

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

export async function persistBabyClothingPhoto(
  entryId: string,
  asset: ImagePickerAsset,
  photoId: string,
  timestamp = Date.now(),
): Promise<BabyClothingPhoto> {
  if (Platform.OS === 'web') {
    return inlineBabyClothingPhoto(asset, photoId, new Date(timestamp));
  }

  const { Directory, File, Paths } = await import('expo-file-system');
  const directory = new Directory(Paths.document, 'baby-clothes-photos');
  directory.create({ idempotent: true, intermediates: true });

  const extension = babyClothingPhotoExtension(asset);
  const destination = new File(
    directory,
    `${babyClothingPhotoBaseName(entryId, photoId)}-${timestamp}.${extension}`,
  );
  const source = new File(asset.uri);
  await source.copy(destination);

  return {
    id: normalizeBabyClothingText(photoId),
    kind: 'managed-file',
    uri: destination.uri,
    createdAt: new Date(timestamp).toISOString(),
  };
}

export async function removeBabyClothingPhoto(photo: BabyClothingPhoto) {
  if (photo.kind !== 'managed-file' || Platform.OS === 'web') {
    return;
  }

  const { File } = await import('expo-file-system');
  const file = new File(photo.uri);
  if (file.exists) {
    file.delete();
  }
}
