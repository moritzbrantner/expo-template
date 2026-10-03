import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

import type { BabyClothingPhoto } from './clothing';
import { normalizeBabyClothingText } from './clothing';
import {
  babyClothingPhotoBaseName,
  babyClothingPhotoExtension,
  inlineBabyClothingPhoto,
} from './media-helpers';

export { babyClothingPhotoBaseName, babyClothingPhotoExtension, inlineBabyClothingPhoto };

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
