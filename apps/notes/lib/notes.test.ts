import assert from 'node:assert/strict';
import test from 'node:test';

import { createNote, deserializeNotes, orderNotes, updateNote } from './notes';

test('creates a note and derives a title from body when needed', () => {
  const note = createNote(
    '',
    ' First line\nSecond line ',
    'note-1',
    new Date('2026-09-09T05:00:00Z'),
  );
  assert.equal(note.title, 'First line');
  assert.equal(note.body, 'First line\nSecond line');
});

test('updates notes without changing their creation timestamp', () => {
  const created = createNote('Draft', 'Body', 'note-1', new Date('2026-09-09T05:00:00Z'));
  const updated = updateNote(created, 'Final', 'Changed', new Date('2026-09-09T06:00:00Z'));
  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.updatedAt, '2026-09-09T06:00:00.000Z');
  assert.deepEqual(orderNotes([created, updated]).map((note) => note.title), ['Final', 'Draft']);
});

test('rejects malformed persisted data', () => {
  assert.deepEqual(deserializeNotes('{broken'), []);
  assert.deepEqual(deserializeNotes('[{"title":"Missing fields"}]'), []);
});
