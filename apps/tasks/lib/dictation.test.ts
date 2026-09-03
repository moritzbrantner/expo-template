import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDictationInput } from './dictation';

test('splits dictated tasks on the standalone next command in prepend order', () => {
  assert.deepEqual(
    parseDictationInput('Buy milk next Call dentist next Book train'),
    {
      completedEntries: ['Call dentist', 'Buy milk'],
      remainder: 'Book train',
    },
  );
});

test('accepts next case-insensitively with surrounding punctuation', () => {
  assert.deepEqual(parseDictationInput('Buy milk NEXT, call dentist Next!'), {
    completedEntries: ['call dentist', 'Buy milk'],
    remainder: '',
  });
});

test('ignores repeated next commands instead of creating empty tasks', () => {
  assert.deepEqual(parseDictationInput('next next Buy milk next next Call dentist'), {
    completedEntries: ['Buy milk'],
    remainder: 'Call dentist',
  });
});

test('does not split words that merely contain next', () => {
  assert.deepEqual(parseDictationInput('Read about nextdoor next Buy next-level tickets'), {
    completedEntries: ['Read about nextdoor'],
    remainder: 'Buy next-level tickets',
  });
});

test('keeps ordinary input as the uncommitted remainder', () => {
  assert.deepEqual(parseDictationInput('  Call   dentist  '), {
    completedEntries: [],
    remainder: 'Call dentist',
  });
});
