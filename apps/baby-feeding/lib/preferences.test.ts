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

  assert.deepEqual(preferences, {
    modes: ['breast-milk', 'pumping', 'formula'],
    buttonPresentation: 'icons-text',
  });
  assert.equal(feedingModeEnabled(preferences!, 'breast-milk'), true);
  assert.equal(feedingModeEnabled(preferences!, 'formula'), true);
});

test('defaults to all feeding methods and icons plus text but still requires one method', () => {
  assert.deepEqual(defaultFeedingPreferences(), {
    modes: ['breast-milk', 'pumping', 'formula'],
    buttonPresentation: 'icons-text',
  });
  assert.equal(createFeedingPreferences([]), null);
});

test('persists a selected button presentation', () => {
  assert.deepEqual(createFeedingPreferences(['pumping'], 'icons'), {
    modes: ['pumping'],
    buttonPresentation: 'icons',
  });
  assert.deepEqual(createFeedingPreferences(['formula'], 'text'), {
    modes: ['formula'],
    buttonPresentation: 'text',
  });
});

test('restores old preferences with the default button style and rejects malformed methods', () => {
  assert.deepEqual(
    deserializeFeedingPreferences(JSON.stringify({ modes: ['breast-milk', 'formula'] })),
    { modes: ['breast-milk', 'formula'], buttonPresentation: 'icons-text' },
  );
  assert.deepEqual(
    deserializeFeedingPreferences(
      JSON.stringify({ modes: ['pumping'], buttonPresentation: 'icons' }),
    ),
    { modes: ['pumping'], buttonPresentation: 'icons' },
  );
  assert.equal(deserializeFeedingPreferences(JSON.stringify({ modes: [] })), null);
  assert.equal(deserializeFeedingPreferences(JSON.stringify({ modes: ['bottle'] })), null);
  assert.equal(deserializeFeedingPreferences('{broken'), null);
});
