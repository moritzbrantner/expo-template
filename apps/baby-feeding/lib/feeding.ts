export type MilkType = 'breast-milk' | 'formula';

export type FeedEntry = {
  id: string;
  kind: 'feed';
  milkType: MilkType;
  amountMl: number;
  occurredAt: number;
};

export type PumpingEntry = {
  id: string;
  kind: 'pumping';
  amountMl: number;
  occurredAt: number;
};

export type FeedingEntry = FeedEntry | PumpingEntry;

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

export function addFeed(log: FeedingLog, entry: Omit<FeedEntry, 'kind'>): FeedingLog {
  if (
    !entry.id ||
    (entry.milkType !== 'breast-milk' && entry.milkType !== 'formula') ||
    !isValidAmountMl(entry.amountMl) ||
    !isValidTimestamp(entry.occurredAt)
  ) {
    return log;
  }

  return {
    entries: sortEntries([...log.entries, { ...entry, kind: 'feed' }]),
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

export function deserializeFeedingLog(value: string | null): FeedingLog {
  if (!value) return emptyFeedingLog();

  try {
    const parsed = JSON.parse(value) as { entries?: unknown };
    if (!Array.isArray(parsed.entries)) return emptyFeedingLog();

    const entries = parsed.entries.filter((candidate): candidate is FeedingEntry => {
      if (!candidate || typeof candidate !== 'object') return false;
      const entry = candidate as Record<string, unknown>;
      if (
        typeof entry.id !== 'string' ||
        !entry.id ||
        !isValidAmountMl(entry.amountMl) ||
        !isValidTimestamp(entry.occurredAt)
      ) {
        return false;
      }

      if (entry.kind === 'pumping') return true;
      return (
        entry.kind === 'feed' &&
        (entry.milkType === 'breast-milk' || entry.milkType === 'formula')
      );
    });

    return { entries: sortEntries(entries) };
  } catch {
    return emptyFeedingLog();
  }
}
