export const FEEDING_PREFERENCES_STORAGE_KEY = '@expo-template/baby-feeding/preferences-v1';

export const FEEDING_MODE_ORDER = ['breast-milk', 'pumping', 'formula'] as const;
export const BUTTON_PRESENTATION_ORDER = ['icons', 'text', 'icons-text'] as const;

export type FeedingMode = (typeof FEEDING_MODE_ORDER)[number];
export type ButtonPresentation = (typeof BUTTON_PRESENTATION_ORDER)[number];

export type FeedingPreferences = {
  modes: FeedingMode[];
  buttonPresentation: ButtonPresentation;
};

function isFeedingMode(value: unknown): value is FeedingMode {
  return value === 'breast-milk' || value === 'pumping' || value === 'formula';
}

function isButtonPresentation(value: unknown): value is ButtonPresentation {
  return value === 'icons' || value === 'text' || value === 'icons-text';
}

export function defaultFeedingPreferences(): FeedingPreferences {
  return { modes: [...FEEDING_MODE_ORDER], buttonPresentation: 'icons-text' };
}

export function createFeedingPreferences(
  modes: readonly FeedingMode[],
  buttonPresentation: ButtonPresentation = 'icons-text',
): FeedingPreferences | null {
  const selected = new Set(modes.filter(isFeedingMode));
  const normalized = FEEDING_MODE_ORDER.filter((mode) => selected.has(mode));
  if (normalized.length === 0 || !isButtonPresentation(buttonPresentation)) return null;
  return { modes: normalized, buttonPresentation };
}

export function deserializeFeedingPreferences(value: string | null): FeedingPreferences | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as { modes?: unknown; buttonPresentation?: unknown };
    if (!Array.isArray(parsed.modes)) return null;
    const validModes = parsed.modes.filter(isFeedingMode);
    if (validModes.length !== parsed.modes.length) return null;
    const buttonPresentation = isButtonPresentation(parsed.buttonPresentation)
      ? parsed.buttonPresentation
      : 'icons-text';
    return createFeedingPreferences(validModes, buttonPresentation);
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
