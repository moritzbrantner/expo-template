import assert from 'node:assert/strict';
import test from 'node:test';

import { addFeed, emptyFeedingLog } from './feeding';
import { buildSharedFeedingUrl } from './sharing';

test('keeps a representative day-sized snapshot comfortably shareable as a URL', () => {
  let log = emptyFeedingLog();
  for (let index = 0; index < 24; index += 1) {
    log = addFeed(log, {
      id: `feed-${index}`,
      milkType: index % 2 === 0 ? 'breast-milk' : 'formula',
      amountMl: 90 + index,
      occurredAt: 1_780_000_000_000 + index * 60 * 60 * 1000,
      bottleUsed: true,
    });
  }

  assert.ok(buildSharedFeedingUrl(log).length < 8_000);
});
