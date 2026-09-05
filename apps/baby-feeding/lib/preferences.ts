export const FEEDING_PREFERENCES_STORAGE_KEY = '@expo-template/baby-feeding/preferences-v1';

export const FEEDING_MODE_ORDER = ['breastfeeding', 'bottle', 'pumping'] as const;

export type FeedingMode = (typeof FEEDING_MODE_ORDER)[number];

export type FeedingPreferences = {
  modes: FeedingMode[];
};

function isFeedingMode(value: unknown): value is FeedingMode {
  return value === 'breastfeeding' || value === 'bottle' || value === 'pumping';
}

export function createFeedingPreferences(modes: readonly FeedingMode[]): FeedingPreferences | null {
  const selected = new Set(modes.filter(isFeedingMode));
  const normalized = FEEDING_MODE_ORDER.filter((mode) => selected.has(mode));
  return normalized.length > 0 ? { modes: normalized } : null;
}

export function deserializeFeedingPreferences(value: string | null): FeedingPreferences | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as { modes?: unknown };
    if (!Array.isArray(parsed.modes)) return null;
    const validModes = parsed.modes.filter(isFeedingMode);
    if (validModes.length !== parsed.modes.length) return null;
    return createFeedingPreferences(validModes);
  } catch {
    return null;
  }
}

export function feedingModeEnabled(
  preferences: FeedingPreferences,
  mode: FeedingMode,
): boolean {
  return preferences.modes.includes(mode);
}
