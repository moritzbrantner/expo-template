import { AssetField, MediaType, Query, requestPermissionsAsync } from 'expo-media-library';

import type { PhotoAsset, RuntimeCapabilities } from './types';

export async function requestPhotoAccess() {
  const permission = await requestPermissionsAsync(false, ['photo']);
  return {
    granted: permission.granted,
    limited: permission.accessPrivileges === 'limited',
  };
}

export async function loadPhotoAssets(limit = 200): Promise<PhotoAsset[]> {
  const assets = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .limit(limit)
    .exe();

  return Promise.all(
    assets.map(async (asset) => {
      const info = await asset.getInfo();
      return {
        id: asset.id,
        uri: info.uri,
        filename: info.filename ?? asset.id,
        width: info.width ?? 0,
        height: info.height ?? 0,
        createdAt: info.creationTime ?? 0,
      };
    }),
  );
}

export function runtimeCapabilities(): RuntimeCapabilities {
  return {
    nativePeopleDetection: true,
    label: 'On-device people detection',
    detail: 'Face pixels and embeddings stay on this device.',
  };
}
