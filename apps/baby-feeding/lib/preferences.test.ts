import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFeedingPreferences,
  deserializeFeedingPreferences,
  feedingModeEnabled,
} from './preferences';

test('keeps selected feeding modes in a stable canonical order', () => {
  const preferences = createFeedingPreferences(['pumping', 'breastfeeding', 'pumping']);

  assert.deepEqual(preferences, { modes: ['breastfeeding', 'pumping'] });
  assert.equal(feedingModeEnabled(preferences!, 'breastfeeding'), true);
  assert.equal(feedingModeEnabled(preferences!, 'bottle'), false);
});

test('requires at least one feeding mode', () => {
  assert.equal(createFeedingPreferences([]), null);
});

test('restores valid preferences and rejects malformed or unknown modes', () => {
  assert.deepEqual(
    deserializeFeedingPreferences(JSON.stringify({ modes: ['bottle', 'pumping'] })),
    { modes: ['bottle', 'pumping'] },
  );
  assert.equal(deserializeFeedingPreferences(JSON.stringify({ modes: [] })), null);
  assert.equal(deserializeFeedingPreferences(JSON.stringify({ modes: ['unknown'] })), null);
  assert.equal(deserializeFeedingPreferences('{broken'), null);
});
