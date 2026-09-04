import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

import type { WardrobePhoto } from './wardrobe';
import { normalizeWardrobeText } from './wardrobe';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export function wardrobePhotoBaseName(itemId: string) {
  const normalized = normalizeWardrobeText(itemId).toLocaleLowerCase();
  const safe = normalized.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe || 'item';
}

export function wardrobePhotoExtension(asset: Pick<ImagePickerAsset, 'fileName' | 'mimeType'>) {
  const fileName = asset.fileName?.toLocaleLowerCase() ?? '';
  const match = fileName.match(/\.([a-z0-9]{2,5})$/);
  if (match?.[1] && ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'avif', 'gif'].includes(match[1])) {
    return match[1] === 'jpeg' ? 'jpg' : match[1];
  }
  return MIME_EXTENSIONS[asset.mimeType ?? ''] ?? 'jpg';
}

export function inlineWardrobePhoto(
  asset: Pick<ImagePickerAsset, 'base64' | 'mimeType'>,
): WardrobePhoto {
  if (!asset.base64) {
    throw new Error('The selected web image did not include local image data.');
  }

  const mimeType = asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg';
  return {
    kind: 'inline-data',
    uri: `data:${mimeType};base64,${asset.base64}`,
  };
}

export async function persistWardrobePhoto(
  itemId: string,
  asset: ImagePickerAsset,
  timestamp = Date.now(),
): Promise<WardrobePhoto> {
  if (Platform.OS === 'web') {
    return inlineWardrobePhoto(asset);
  }

  const { Directory, File, Paths } = await import('expo-file-system');
  const directory = new Directory(Paths.document, 'wardrobe-photos');
  directory.create({ idempotent: true, intermediates: true });

  const extension = wardrobePhotoExtension(asset);
  const destination = new File(
    directory,
    `${wardrobePhotoBaseName(itemId)}-${timestamp}.${extension}`,
  );
  const source = new File(asset.uri);
  await source.copy(destination);

  return {
    kind: 'managed-file',
    uri: destination.uri,
  };
}

export async function removeWardrobePhoto(photo: WardrobePhoto | null) {
  if (!photo || photo.kind !== 'managed-file' || Platform.OS === 'web') {
    return;
  }

  const { File } = await import('expo-file-system');
  const file = new File(photo.uri);
  if (file.exists) {
    file.delete();
  }
}
