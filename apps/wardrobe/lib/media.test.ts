import assert from 'node:assert/strict';
import test from 'node:test';

import {
  inlineWardrobePhoto,
  wardrobePhotoBaseName,
  wardrobePhotoExtension,
} from './media';

test('builds deterministic safe photo names from wardrobe ids', () => {
  assert.equal(wardrobePhotoBaseName('  Shirt / 01  '), 'shirt-01');
  assert.equal(wardrobePhotoBaseName('___'), '___');
  assert.equal(wardrobePhotoBaseName('***'), 'item');
});

test('preserves supported image extensions and falls back from mime type', () => {
  assert.equal(wardrobePhotoExtension({ fileName: 'IMG_1.JPEG', mimeType: null }), 'jpg');
  assert.equal(wardrobePhotoExtension({ fileName: 'photo.heic', mimeType: 'image/heic' }), 'heic');
  assert.equal(wardrobePhotoExtension({ fileName: null, mimeType: 'image/webp' }), 'webp');
  assert.equal(wardrobePhotoExtension({ fileName: 'image.unknown', mimeType: null }), 'jpg');
});

test('creates an inline web photo from picker base64 data', () => {
  assert.deepEqual(inlineWardrobePhoto({ base64: 'abc123', mimeType: 'image/png' }), {
    kind: 'inline-data',
    uri: 'data:image/png;base64,abc123',
  });
  assert.throws(
    () => inlineWardrobePhoto({ base64: null, mimeType: 'image/jpeg' }),
    /did not include local image data/i,
  );
});
