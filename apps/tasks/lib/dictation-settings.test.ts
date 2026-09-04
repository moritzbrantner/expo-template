import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_DICTATION_COMMANDS,
  createDictationCommands,
  deserializeDictationCommands,
} from './dictation-settings';

test('normalizes configurable dictation command words', () => {
  assert.deepEqual(createDictationCommands('  Weiter  ', 'FERTIG'), {
    next: 'weiter',
    done: 'fertig',
  });
});

test('supports Unicode command words', () => {
  assert.deepEqual(createDictationCommands('nächste', 'fertig'), {
    next: 'nächste',
    done: 'fertig',
  });
});

test('requires distinct non-empty single-word commands', () => {
  assert.equal(createDictationCommands('', 'done'), null);
  assert.equal(createDictationCommands('new entry', 'done'), null);
  assert.equal(createDictationCommands('next!', 'done'), null);
  assert.equal(createDictationCommands('next', ' NEXT '), null);
});

test('deserializes valid persisted commands', () => {
  assert.deepEqual(
    deserializeDictationCommands(JSON.stringify({ next: 'weiter', done: 'fertig' })),
    { next: 'weiter', done: 'fertig' },
  );
});

test('falls back to defaults for damaged or invalid persisted settings', () => {
  assert.deepEqual(deserializeDictationCommands('{broken'), DEFAULT_DICTATION_COMMANDS);
  assert.deepEqual(
    deserializeDictationCommands(JSON.stringify({ next: 'same', done: 'same' })),
    DEFAULT_DICTATION_COMMANDS,
  );
});
