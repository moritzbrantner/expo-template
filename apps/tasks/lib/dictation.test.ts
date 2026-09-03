import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDictationInput } from './dictation';

test('splits dictated tasks on the standalone next command in prepend order', () => {
  assert.deepEqual(
    parseDictationInput('Buy milk next Call dentist next Book train'),
    {
      completedEntries: ['Call dentist', 'Buy milk'],
      remainder: 'Book train',
      finishRequested: false,
    },
  );
});

test('accepts next case-insensitively with surrounding punctuation', () => {
  assert.deepEqual(parseDictationInput('Buy milk NEXT, call dentist Next!'), {
    completedEntries: ['call dentist', 'Buy milk'],
    remainder: '',
    finishRequested: false,
  });
});

test('ignores repeated next commands instead of creating empty tasks', () => {
  assert.deepEqual(parseDictationInput('next next Buy milk next next Call dentist'), {
    completedEntries: ['Buy milk'],
    remainder: 'Call dentist',
    finishRequested: false,
  });
});

test('does not split words that merely contain next', () => {
  assert.deepEqual(parseDictationInput('Read about nextdoor next Buy next-level tickets'), {
    completedEntries: ['Read about nextdoor'],
    remainder: 'Buy next-level tickets',
    finishRequested: false,
  });
});

test('keeps ordinary input as the uncommitted remainder', () => {
  assert.deepEqual(parseDictationInput('  Call   dentist  '), {
    completedEntries: [],
    remainder: 'Call dentist',
    finishRequested: false,
  });
});

test('done commits the final entry and requests dictation to finish', () => {
  assert.deepEqual(parseDictationInput('Buy milk next Call dentist done'), {
    completedEntries: ['Call dentist', 'Buy milk'],
    remainder: '',
    finishRequested: true,
  });
});

test('accepts done case-insensitively with punctuation', () => {
  assert.deepEqual(parseDictationInput('Book train DONE!'), {
    completedEntries: ['Book train'],
    remainder: '',
    finishRequested: true,
  });
});

test('done by itself finishes without creating an empty task', () => {
  assert.deepEqual(parseDictationInput('done'), {
    completedEntries: [],
    remainder: '',
    finishRequested: true,
  });
});

test('done is ordinary task text unless it is the final token', () => {
  assert.deepEqual(parseDictationInput('Get taxes done tomorrow'), {
    completedEntries: [],
    remainder: 'Get taxes done tomorrow',
    finishRequested: false,
  });
});
