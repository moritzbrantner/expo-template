import { describe, expect, test } from 'bun:test';

import {
  babyClothingPhotoBaseName,
  babyClothingPhotoExtension,
  inlineBabyClothingPhoto,
} from './media';

describe('baby clothing photo helpers', () => {
  test('creates filesystem-safe local photo names', () => {
    expect(babyClothingPhotoBaseName('Body 62 / Blue', 'Photo 1')).toBe('body-62-blue-photo-1');
  });

  test('uses filename extension first and MIME type as fallback', () => {
    expect(babyClothingPhotoExtension({ fileName: 'piece.JPEG', mimeType: 'image/png' })).toBe('jpg');
    expect(babyClothingPhotoExtension({ fileName: null, mimeType: 'image/webp' })).toBe('webp');
  });

  test('web photos remain explicit local inline data', () => {
    const photo = inlineBabyClothingPhoto(
      { base64: 'ZmFrZQ==', mimeType: 'image/png' },
      'photo-1',
      new Date('2026-09-05T10:00:00Z'),
    );

    expect(photo).toEqual({
      id: 'photo-1',
      kind: 'inline-data',
      uri: 'data:image/png;base64,ZmFrZQ==',
      createdAt: '2026-09-05T10:00:00.000Z',
    });
  });
});
