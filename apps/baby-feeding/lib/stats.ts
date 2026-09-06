import { formatDateInput, type FeedingLog } from './feeding';

export type DailyFeedingStats = {
  dayStart: number;
  breastMilkMl: number;
  formulaMl: number;
  pumpedMl: number;
  breastfeedingSessions: number;
};

export type FeedingStatsSummary = {
  days: DailyFeedingStats[];
  measuredIntakeMl: number;
  pumpedMl: number;
  breastfeedingSessions: number;
};

export function summarizeFeedingLog(
  log: FeedingLog,
  dayCount = 7,
  referenceTimestamp = Date.now(),
): FeedingStatsSummary {
  const count = Number.isSafeInteger(dayCount) ? Math.max(1, Math.min(31, dayCount)) : 7;
  const referenceDay = new Date(referenceTimestamp);
  referenceDay.setHours(0, 0, 0, 0);

  const days: DailyFeedingStats[] = [];
  const byDate = new Map<string, DailyFeedingStats>();

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(referenceDay);
    date.setDate(referenceDay.getDate() - offset);
    const day: DailyFeedingStats = {
      dayStart: date.getTime(),
      breastMilkMl: 0,
      formulaMl: 0,
      pumpedMl: 0,
      breastfeedingSessions: 0,
    };
    days.push(day);
    byDate.set(formatDateInput(day.dayStart), day);
  }

  for (const entry of log.entries) {
    const day = byDate.get(formatDateInput(entry.occurredAt));
    if (!day) continue;

    if (entry.kind === 'feed') {
      if (entry.milkType === 'breast-milk') day.breastMilkMl += entry.amountMl;
      else day.formulaMl += entry.amountMl;
    } else if (entry.kind === 'pumping') {
      day.pumpedMl += entry.amountMl;
    } else if (entry.kind === 'breastfeeding') {
      day.breastfeedingSessions += 1;
    }
  }

  return {
    days,
    measuredIntakeMl: days.reduce(
      (total, day) => total + day.breastMilkMl + day.formulaMl,
      0,
    ),
    pumpedMl: days.reduce((total, day) => total + day.pumpedMl, 0),
    breastfeedingSessions: days.reduce(
      (total, day) => total + day.breastfeedingSessions,
      0,
    ),
  };
}
