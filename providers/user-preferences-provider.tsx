import {
  AccessibilityInfo,
  useColorScheme as useSystemColorScheme,
  type AccessibilityInfoStatic,
} from 'react-native';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import {
  readPreferredLanguage,
  resolveColorBlindModePreference,
  type UserAccessibilityPreferences,
  type UserPreferenceSnapshot,
} from '@/lib/user-preferences';

type UserPreferencesContextValue = UserPreferenceSnapshot;

const DEFAULT_ACCESSIBILITY_PREFERENCES: UserAccessibilityPreferences = {
  grayscaleEnabled: false,
  invertColorsEnabled: false,
  highTextContrastEnabled: false,
  darkerSystemColorsEnabled: false,
};

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

async function readAccessibilityPreference(
  reader: (() => Promise<boolean>) | undefined,
) {
  if (!reader) {
    return false;
  }

  try {
    return await reader();
  } catch {
    return false;
  }
}

function subscribeToPreferenceChange(
  accessibilityInfo: AccessibilityInfoStatic,
  eventName:
    | 'grayscaleChanged'
    | 'invertColorsChanged'
    | 'highTextContrastChanged'
    | 'darkerSystemColorsChanged',
  listener: (enabled: boolean) => void,
) {
  try {
    return accessibilityInfo.addEventListener(eventName, listener);
  } catch {
    return null;
  }
}

export function UserPreferencesProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useSystemColorScheme();
  const [language, setLanguage] = useState(() => readPreferredLanguage());
  const [accessibilityPreferences, setAccessibilityPreferences] = useState(DEFAULT_ACCESSIBILITY_PREFERENCES);

  useEffect(() => {
    let isMounted = true;

    async function hydrateAccessibilityPreferences() {
      const [
        grayscaleEnabled,
        invertColorsEnabled,
        highTextContrastEnabled,
        darkerSystemColorsEnabled,
      ] = await Promise.all([
        readAccessibilityPreference(AccessibilityInfo.isGrayscaleEnabled),
        readAccessibilityPreference(AccessibilityInfo.isInvertColorsEnabled),
        readAccessibilityPreference(AccessibilityInfo.isHighTextContrastEnabled),
        readAccessibilityPreference(AccessibilityInfo.isDarkerSystemColorsEnabled),
      ]);

      if (!isMounted) {
        return;
      }

      setAccessibilityPreferences({
        grayscaleEnabled,
        invertColorsEnabled,
        highTextContrastEnabled,
        darkerSystemColorsEnabled,
      });
    }

    void hydrateAccessibilityPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleLanguageChange = () => {
      setLanguage(readPreferredLanguage());
    };

    window.addEventListener('languagechange', handleLanguageChange);

    return () => {
      window.removeEventListener('languagechange', handleLanguageChange);
    };
  }, []);

  useEffect(() => {
    const subscriptions = [
      subscribeToPreferenceChange(AccessibilityInfo, 'grayscaleChanged', (enabled) => {
        setAccessibilityPreferences((current) => ({
          ...current,
          grayscaleEnabled: enabled,
        }));
      }),
      subscribeToPreferenceChange(AccessibilityInfo, 'invertColorsChanged', (enabled) => {
        setAccessibilityPreferences((current) => ({
          ...current,
          invertColorsEnabled: enabled,
        }));
      }),
      subscribeToPreferenceChange(AccessibilityInfo, 'highTextContrastChanged', (enabled) => {
        setAccessibilityPreferences((current) => ({
          ...current,
          highTextContrastEnabled: enabled,
        }));
      }),
      subscribeToPreferenceChange(AccessibilityInfo, 'darkerSystemColorsChanged', (enabled) => {
        setAccessibilityPreferences((current) => ({
          ...current,
          darkerSystemColorsEnabled: enabled,
        }));
      }),
    ];

    return () => {
      for (const subscription of subscriptions) {
        subscription?.remove();
      }
    };
  }, []);

  const value = useMemo<UserPreferencesContextValue>(
    () => ({
      preferredTheme: systemColorScheme === 'dark' ? 'dark' : 'light',
      colorBlindModeEnabled: resolveColorBlindModePreference(accessibilityPreferences),
      language,
    }),
    [accessibilityPreferences, language, systemColorScheme],
  );

  return <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>;
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);

  if (!context) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }

  return context;
}
