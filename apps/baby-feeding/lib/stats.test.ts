import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addBottleCare,
  addBreastfeeding,
  addFeed,
  addPumping,
  emptyFeedingLog,
} from './feeding';
import { summarizeFeedingLog } from './stats';

test('summarizes measured intake, pumping, and direct breastfeeding by local day', () => {
  let log = emptyFeedingLog();
  log = addFeed(log, {
    id: 'breast-bottle',
    milkType: 'breast-milk',
    amountMl: 120,
    occurredAt: new Date(2026, 8, 5, 8, 0).getTime(),
    bottleUsed: true,
  });
  log = addFeed(log, {
    id: 'formula-one',
    milkType: 'formula',
    amountMl: 80,
    occurredAt: new Date(2026, 8, 5, 12, 0).getTime(),
    bottleUsed: true,
  });
  log = addPumping(log, {
    id: 'pump-one',
    amountMl: 150,
    occurredAt: new Date(2026, 8, 5, 15, 0).getTime(),
  });
  log = addBreastfeeding(log, {
    id: 'direct-one',
    occurredAt: new Date(2026, 8, 5, 18, 0).getTime(),
  });
  log = addFeed(log, {
    id: 'formula-two',
    milkType: 'formula',
    amountMl: 90,
    occurredAt: new Date(2026, 8, 6, 9, 0).getTime(),
    bottleUsed: true,
  });
  log = addBottleCare(log, {
    id: 'clean',
    kind: 'bottle-clean',
    occurredAt: new Date(2026, 8, 6, 10, 0).getTime(),
  });

  const summary = summarizeFeedingLog(log, 2, new Date(2026, 8, 6, 14, 0).getTime());

  assert.equal(summary.days.length, 2);
  assert.deepEqual(
    summary.days.map(({ breastMilkMl, formulaMl, pumpedMl, breastfeedingSessions }) => ({
      breastMilkMl,
      formulaMl,
      pumpedMl,
      breastfeedingSessions,
    })),
    [
      { breastMilkMl: 120, formulaMl: 80, pumpedMl: 150, breastfeedingSessions: 1 },
      { breastMilkMl: 0, formulaMl: 90, pumpedMl: 0, breastfeedingSessions: 0 },
    ],
  );
  assert.equal(summary.measuredIntakeMl, 290);
  assert.equal(summary.pumpedMl, 150);
  assert.equal(summary.breastfeedingSessions, 1);
});
