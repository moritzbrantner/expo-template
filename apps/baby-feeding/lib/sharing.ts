import { deserializeFeedingLog, type FeedingEntry, type FeedingLog } from './feeding';

export const BABY_FEEDING_STORAGE_KEY = '@expo-template/baby-feeding/log-v1';
export const SHARE_QUERY_PARAM = 'state';
export const SHARE_BASE_URL = 'https://moritzbrantner.github.io/expo-template/baby-feeding/';

const SHARE_VERSION = 2;

type CompactFeedEntry = ['f', string, number, number, 'b' | 'f', 0 | 1];
type CompactBreastfeedingEntry = ['n', string, number];
type CompactPumpingEntry = ['p', string, number, number];
type CompactBottleCareEntry = ['c' | 's', string, number];
type CompactEntry =
  | CompactFeedEntry
  | CompactBreastfeedingEntry
  | CompactPumpingEntry
  | CompactBottleCareEntry;
type SharePayloadV1 = [1, Exclude<CompactEntry, CompactBreastfeedingEntry>[]];
type SharePayloadV2 = [typeof SHARE_VERSION, CompactEntry[]];
type SharePayload = SharePayloadV1 | SharePayloadV2;

function compactEntry(entry: FeedingEntry): CompactEntry {
  if (entry.kind === 'feed') {
    return [
      'f',
      entry.id,
      entry.occurredAt,
      entry.amountMl,
      entry.milkType === 'breast-milk' ? 'b' : 'f',
      entry.bottleUsed ? 1 : 0,
    ];
  }

  if (entry.kind === 'breastfeeding') {
    return ['n', entry.id, entry.occurredAt];
  }

  if (entry.kind === 'pumping') {
    return ['p', entry.id, entry.occurredAt, entry.amountMl];
  }

  return [entry.kind === 'bottle-clean' ? 'c' : 's', entry.id, entry.occurredAt];
}

function expandEntry(candidate: unknown, version: 1 | 2): FeedingEntry | null {
  if (!Array.isArray(candidate) || typeof candidate[0] !== 'string') return null;

  if (candidate[0] === 'f') {
    if (
      candidate.length !== 6 ||
      typeof candidate[1] !== 'string' ||
      typeof candidate[2] !== 'number' ||
      typeof candidate[3] !== 'number' ||
      (candidate[4] !== 'b' && candidate[4] !== 'f') ||
      (candidate[5] !== 0 && candidate[5] !== 1)
    ) {
      return null;
    }

    return {
      id: candidate[1],
      kind: 'feed',
      occurredAt: candidate[2],
      amountMl: candidate[3],
      milkType: candidate[4] === 'b' ? 'breast-milk' : 'formula',
      bottleUsed: candidate[5] === 1,
    };
  }

  if (candidate[0] === 'n') {
    if (
      version !== 2 ||
      candidate.length !== 3 ||
      typeof candidate[1] !== 'string' ||
      typeof candidate[2] !== 'number'
    ) {
      return null;
    }

    return {
      id: candidate[1],
      kind: 'breastfeeding',
      occurredAt: candidate[2],
    };
  }

  if (candidate[0] === 'p') {
    if (
      candidate.length !== 4 ||
      typeof candidate[1] !== 'string' ||
      typeof candidate[2] !== 'number' ||
      typeof candidate[3] !== 'number'
    ) {
      return null;
    }

    return {
      id: candidate[1],
      kind: 'pumping',
      occurredAt: candidate[2],
      amountMl: candidate[3],
    };
  }

  if (candidate[0] === 'c' || candidate[0] === 's') {
    if (
      candidate.length !== 3 ||
      typeof candidate[1] !== 'string' ||
      typeof candidate[2] !== 'number'
    ) {
      return null;
    }

    return {
      id: candidate[1],
      kind: candidate[0] === 'c' ? 'bottle-clean' : 'bottle-sterilize',
      occurredAt: candidate[2],
    };
  }

  return null;
}

export function encodeSharedFeedingLog(log: FeedingLog): string {
  const payload: SharePayloadV2 = [SHARE_VERSION, log.entries.map(compactEntry)];
  return JSON.stringify(payload);
}

export function decodeSharedFeedingLog(value: unknown): FeedingLog | null {
  if (typeof value !== 'string' || value.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    try {
      parsed = JSON.parse(decodeURIComponent(value));
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed) || parsed.length !== 2) return null;
  if (parsed[0] !== 1 && parsed[0] !== SHARE_VERSION) return null;
  if (!Array.isArray(parsed[1])) return null;

  const payload = parsed as SharePayload;
  const version = payload[0];
  const expanded = payload[1].map((candidate) => expandEntry(candidate, version));
  if (expanded.some((entry) => entry === null)) return null;

  const entries = expanded.filter((entry): entry is FeedingEntry => entry !== null);
  const restored = deserializeFeedingLog(JSON.stringify({ entries }));
  if (restored.entries.length !== entries.length) return null;

  return restored;
}

export function buildSharedFeedingUrl(log: FeedingLog): string {
  return `${SHARE_BASE_URL}?${SHARE_QUERY_PARAM}=${encodeURIComponent(encodeSharedFeedingLog(log))}`;
}

export function feedingLogsEqual(left: FeedingLog, right: FeedingLog): boolean {
  return encodeSharedFeedingLog(left) === encodeSharedFeedingLog(right);
}
