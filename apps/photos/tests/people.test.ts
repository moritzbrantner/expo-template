import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  addAnalysedPhoto,
  createAlbum,
  mergePeople,
  renamePerson,
  splitFace,
  togglePhotoInAlbum,
} from '../lib/people';
import { EMPTY_LIBRARY, type FaceAnalysis, type PhotoAsset } from '../lib/types';

function photo(id: string, createdAt = 1): PhotoAsset {
  return {
    id,
    uri: `file://${id}.jpg`,
    filename: `${id}.jpg`,
    width: 100,
    height: 100,
    createdAt,
  };
}

function face(embedding: number[]): FaceAnalysis {
  return {
    box: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
    score: 0.99,
    embedding,
  };
}

describe('people clustering', () => {
  test('clusters nearby embeddings and separates distant ones', () => {
    let state = addAnalysedPhoto(EMPTY_LIBRARY, photo('a'), [face([1, 0, 0])], 0.8);
    state = addAnalysedPhoto(state, photo('b'), [face([0.98, 0.05, 0])], 0.8);
    state = addAnalysedPhoto(state, photo('c'), [face([0, 1, 0])], 0.8);

    assert.equal(state.people.length, 2);
    assert.deepEqual(
      state.people.map((person) => person.faceIds.length).sort(),
      [1, 2],
    );
  });

  test('renames, merges, and splits clusters without losing face observations', () => {
    let state = addAnalysedPhoto(
      EMPTY_LIBRARY,
      photo('a'),
      [face([1, 0]), face([0, 1])],
      0.95,
    );
    assert.equal(state.people.length, 2);

    const first = state.people[0];
    const second = state.people[1];
    state = renamePerson(state, first.id, 'Anna');
    state = mergePeople(state, second.id, first.id);

    assert.equal(state.people.length, 1);
    assert.equal(state.people[0].name, 'Anna');
    assert.equal(state.people[0].faceIds.length, 2);
    assert.equal(state.faces.length, 2);

    const faceToSplit = state.people[0].faceIds[1];
    state = splitFace(state, state.people[0].id, faceToSplit);
    assert.equal(state.people.length, 2);
    assert.deepEqual(
      state.people.map((person) => person.faceIds.length).sort(),
      [1, 1],
    );
    assert.equal(state.faces.length, 2);
  });
});

describe('albums', () => {
  test('creates an album and toggles indexed photo references', () => {
    let state = addAnalysedPhoto(EMPTY_LIBRARY, photo('a'), []);
    state = createAlbum(state, 'Family', 42);
    assert.equal(state.albums.length, 1);

    state = togglePhotoInAlbum(state, state.albums[0].id, 'a');
    assert.deepEqual(state.albums[0].assetIds, ['a']);

    state = togglePhotoInAlbum(state, state.albums[0].id, 'a');
    assert.deepEqual(state.albums[0].assetIds, []);
  });
});
