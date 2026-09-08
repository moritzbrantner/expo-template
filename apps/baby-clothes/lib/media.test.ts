import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  babyClothingPhotoBaseName,
  babyClothingPhotoExtension,
  inlineBabyClothingPhoto,
} from './media';

describe('baby clothing photo helpers', () => {
  test('creates filesystem-safe local photo names', () => {
    assert.equal(
      babyClothingPhotoBaseName('Body 62 / Blue', 'Photo 1'),
      'body-62-blue-photo-1',
    );
  });

  test('uses filename extension first and MIME type as fallback', () => {
    assert.equal(
      babyClothingPhotoExtension({ fileName: 'piece.JPEG', mimeType: 'image/png' }),
      'jpg',
    );
    assert.equal(
      babyClothingPhotoExtension({ fileName: null, mimeType: 'image/webp' }),
      'webp',
    );
  });

  test('web photos remain explicit local inline data', () => {
    const photo = inlineBabyClothingPhoto(
      { base64: 'ZmFrZQ==', mimeType: 'image/png' },
      'photo-1',
      new Date('2026-09-05T10:00:00Z'),
    );

    assert.deepEqual(photo, {
      id: 'photo-1',
      kind: 'inline-data',
      uri: 'data:image/png;base64,ZmFrZQ==',
      createdAt: '2026-09-05T10:00:00.000Z',
    });
  });
});
