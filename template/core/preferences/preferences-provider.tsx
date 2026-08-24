import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { resolveDeviceLocale, translate, type AppLocale, type TranslationKey } from '../i18n';
import {
  loadPreferences,
  savePreferences,
  type Preferences,
  type ThemeMode,
} from './preferences-store';

type PreferencesContextValue = {
  preferences: Preferences;
  ready: boolean;
  setLocale: (locale: AppLocale) => void;
  setThemeMode: (mode: ThemeMode) => void;
  t: (key: TranslationKey) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState<Preferences>({
    themeMode: 'system',
    locale: resolveDeviceLocale(),
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    void loadPreferences({
      themeMode: 'system',
      locale: resolveDeviceLocale(),
    }).then((stored) => {
      if (!active) return;
      // Persisted preferences intentionally hydrate this external-store snapshot.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreferences(stored);
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      ready,
      setLocale(locale) {
        setPreferences((current) => {
          const next = { ...current, locale };
          void savePreferences(next);
          return next;
        });
      },
      setThemeMode(themeMode) {
        setPreferences((current) => {
          const next = { ...current, themeMode };
          void savePreferences(next);
          return next;
        });
      },
      t: (key) => translate(preferences.locale, key),
    }),
    [preferences, ready],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}
