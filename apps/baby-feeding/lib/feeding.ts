export type MilkType = 'breast-milk' | 'formula';
export type BottleCareKind = 'bottle-clean' | 'bottle-sterilize';

export type FeedEntry = {
  id: string;
  kind: 'feed';
  milkType: MilkType;
  amountMl: number;
  occurredAt: number;
  bottleUsed: boolean;
};

export type PumpingEntry = {
  id: string;
  kind: 'pumping';
  amountMl: number;
  occurredAt: number;
};

export type BottleCareEntry = {
  id: string;
  kind: BottleCareKind;
  occurredAt: number;
};

export type FeedingEntry = FeedEntry | PumpingEntry | BottleCareEntry;

export type FeedingLog = {
  entries: FeedingEntry[];
};

export function emptyFeedingLog(): FeedingLog {
  return { entries: [] };
}

function isValidAmountMl(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function sortEntries(entries: FeedingEntry[]) {
  return [...entries].sort(
    (left, right) => left.occurredAt - right.occurredAt || left.id.localeCompare(right.id),
  );
}

export function addFeed(
  log: FeedingLog,
  entry: Omit<FeedEntry, 'kind' | 'bottleUsed'> & { bottleUsed?: boolean },
): FeedingLog {
  if (
    !entry.id ||
    (entry.milkType !== 'breast-milk' && entry.milkType !== 'formula') ||
    !isValidAmountMl(entry.amountMl) ||
    !isValidTimestamp(entry.occurredAt) ||
    (entry.bottleUsed !== undefined && typeof entry.bottleUsed !== 'boolean')
  ) {
    return log;
  }

  return {
    entries: sortEntries([
      ...log.entries,
      { ...entry, bottleUsed: entry.bottleUsed ?? false, kind: 'feed' },
    ]),
  };
}

export function addPumping(log: FeedingLog, entry: Omit<PumpingEntry, 'kind'>): FeedingLog {
  if (!entry.id || !isValidAmountMl(entry.amountMl) || !isValidTimestamp(entry.occurredAt)) {
    return log;
  }

  return {
    entries: sortEntries([...log.entries, { ...entry, kind: 'pumping' }]),
  };
}

export function addBottleCare(
  log: FeedingLog,
  entry: Omit<BottleCareEntry, 'kind'> & { kind: BottleCareKind },
): FeedingLog {
  if (
    !entry.id ||
    (entry.kind !== 'bottle-clean' && entry.kind !== 'bottle-sterilize') ||
    !isValidTimestamp(entry.occurredAt)
  ) {
    return log;
  }

  return { entries: sortEntries([...log.entries, entry]) };
}

export function removeEntry(log: FeedingLog, id: string): FeedingLog {
  return { entries: log.entries.filter((entry) => entry.id !== id) };
}

export function latestFeed(log: FeedingLog): FeedEntry | null {
  for (let index = log.entries.length - 1; index >= 0; index -= 1) {
    const entry = log.entries[index];
    if (entry.kind === 'feed') return entry;
  }
  return null;
}

export function latestBottleCare(log: FeedingLog, kind: BottleCareKind): BottleCareEntry | null {
  for (let index = log.entries.length - 1; index >= 0; index -= 1) {
    const entry = log.entries[index];
    if (entry.kind === kind) return entry;
  }
  return null;
}

export function dirtyBottleCount(log: FeedingLog): number {
  let dirty = 0;

  for (const entry of sortEntries(log.entries)) {
    if (entry.kind === 'bottle-clean') {
      dirty = 0;
    } else if (entry.kind === 'feed' && entry.bottleUsed) {
      dirty += 1;
    }
  }

  return dirty;
}

export function formatDateInput(timestamp: number): string {
  const date = new Date(timestamp);
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function formatTimeInput(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function parseLocalDateTime(dateText: string, timeText: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeText.trim());
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date.getTime();
}

export function roundToFiveMinutes(timestamp: number): number {
  const date = new Date(timestamp);
  date.setSeconds(0, 0);
  date.setMinutes(Math.round(date.getMinutes() / 5) * 5);
  return date.getTime();
}

export function adjustLocalMinutes(timestamp: number, deltaMinutes: number): number {
  const date = new Date(timestamp);
  date.setMinutes(date.getMinutes() + deltaMinutes);
  return date.getTime();
}

export function adjustLocalDays(timestamp: number, deltaDays: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + deltaDays);
  return date.getTime();
}

export function deserializeFeedingLog(value: string | null): FeedingLog {
  if (!value) return emptyFeedingLog();

  try {
    const parsed = JSON.parse(value) as { entries?: unknown };
    if (!Array.isArray(parsed.entries)) return emptyFeedingLog();

    const entries = parsed.entries.flatMap<FeedingEntry>((candidate) => {
      if (!candidate || typeof candidate !== 'object') return [];
      const entry = candidate as Record<string, unknown>;
      if (typeof entry.id !== 'string' || !entry.id || !isValidTimestamp(entry.occurredAt)) {
        return [];
      }

      if (entry.kind === 'bottle-clean' || entry.kind === 'bottle-sterilize') {
        return [{ id: entry.id, kind: entry.kind, occurredAt: entry.occurredAt }];
      }

      if (!isValidAmountMl(entry.amountMl)) return [];

      if (entry.kind === 'pumping') {
        return [
          {
            id: entry.id,
            kind: 'pumping',
            amountMl: entry.amountMl,
            occurredAt: entry.occurredAt,
          },
        ];
      }

      if (
        entry.kind === 'feed' &&
        (entry.milkType === 'breast-milk' || entry.milkType === 'formula') &&
        (entry.bottleUsed === undefined || typeof entry.bottleUsed === 'boolean')
      ) {
        return [
          {
            id: entry.id,
            kind: 'feed',
            milkType: entry.milkType,
            amountMl: entry.amountMl,
            occurredAt: entry.occurredAt,
            bottleUsed: entry.bottleUsed ?? false,
          },
        ];
      }

      return [];
    });

    return { entries: sortEntries(entries) };
  } catch {
    return emptyFeedingLog();
  }
}
