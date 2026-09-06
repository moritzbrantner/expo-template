import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFeedingPreferences,
  defaultFeedingPreferences,
  deserializeFeedingPreferences,
  feedingModeEnabled,
} from './preferences';

test('keeps selected feeding methods in a stable canonical order', () => {
  const preferences = createFeedingPreferences(['formula', 'breast-milk', 'formula', 'pumping']);

  assert.deepEqual(preferences, { modes: ['breast-milk', 'pumping', 'formula'] });
  assert.equal(feedingModeEnabled(preferences!, 'breast-milk'), true);
  assert.equal(feedingModeEnabled(preferences!, 'formula'), true);
});

test('defaults to all feeding methods but still requires one explicit selection', () => {
  assert.deepEqual(defaultFeedingPreferences(), {
    modes: ['breast-milk', 'pumping', 'formula'],
  });
  assert.equal(createFeedingPreferences([]), null);
});

test('restores valid preferences and rejects malformed or unknown methods', () => {
  assert.deepEqual(
    deserializeFeedingPreferences(JSON.stringify({ modes: ['breast-milk', 'formula'] })),
    { modes: ['breast-milk', 'formula'] },
  );
  assert.equal(deserializeFeedingPreferences(JSON.stringify({ modes: [] })), null);
  assert.equal(deserializeFeedingPreferences(JSON.stringify({ modes: ['bottle'] })), null);
  assert.equal(deserializeFeedingPreferences('{broken'), null);
});
