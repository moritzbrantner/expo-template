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

test('supports Unicode and numeric command words', () => {
  assert.deepEqual(createDictationCommands('nächste', 'fertig'), {
    next: 'nächste',
    done: 'fertig',
  });
  assert.deepEqual(createDictationCommands('1', '2'), {
    next: '1',
    done: '2',
  });
});

test('requires distinct non-empty single-word commands', () => {
  assert.equal(createDictationCommands('', 'done'), null);
  assert.equal(createDictationCommands('next', ''), null);
  assert.equal(createDictationCommands('new entry', 'done'), null);
  assert.equal(createDictationCommands('next!', 'done'), null);
  assert.equal(createDictationCommands('next-step', 'done'), null);
  assert.equal(createDictationCommands('next', ' NEXT '), null);
});

test('deserializes and normalizes valid persisted commands', () => {
  assert.deepEqual(
    deserializeDictationCommands(JSON.stringify({ next: ' Weiter ', done: 'FERTIG' })),
    { next: 'weiter', done: 'fertig' },
  );
});

test('ignores unrelated persisted fields', () => {
  assert.deepEqual(
    deserializeDictationCommands(
      JSON.stringify({ next: 'weiter', done: 'fertig', futureSetting: true }),
    ),
    { next: 'weiter', done: 'fertig' },
  );
});

test('falls back to defaults for missing, damaged, or wrong-shaped storage', () => {
  const invalidPayloads = [
    null,
    '',
    '{broken',
    JSON.stringify('commands'),
    JSON.stringify([]),
    JSON.stringify({}),
    JSON.stringify({ next: 'weiter' }),
    JSON.stringify({ next: 1, done: 'fertig' }),
    JSON.stringify({ next: 'same', done: 'same' }),
    JSON.stringify({ next: 'next!', done: 'done' }),
  ];

  for (const payload of invalidPayloads) {
    assert.deepEqual(deserializeDictationCommands(payload), DEFAULT_DICTATION_COMMANDS);
  }
});

test('returns the stable defaults without mutating them', () => {
  const first = deserializeDictationCommands(null);
  const second = deserializeDictationCommands(null);

  assert.deepEqual(first, { next: 'next', done: 'done' });
  assert.deepEqual(second, { next: 'next', done: 'done' });
  assert.deepEqual(DEFAULT_DICTATION_COMMANDS, { next: 'next', done: 'done' });
});
