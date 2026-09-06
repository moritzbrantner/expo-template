import assert from 'node:assert/strict';
import test from 'node:test';

import { isEarlierLocalDay } from './recording-time';

test('only treats timestamps from an earlier local calendar day as needing date controls', () => {
  const reference = new Date(2026, 8, 6, 0, 10).getTime();

  assert.equal(isEarlierLocalDay(new Date(2026, 8, 5, 23, 55).getTime(), reference), true);
  assert.equal(isEarlierLocalDay(new Date(2026, 8, 6, 0, 1).getTime(), reference), false);
  assert.equal(isEarlierLocalDay(new Date(2026, 8, 7, 0, 1).getTime(), reference), false);
});
