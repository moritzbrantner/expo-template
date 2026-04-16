import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { useColorScheme as useSystemColorScheme } from '@/hooks/use-color-scheme';
import { loadPersistedThemeMode, persistThemeMode, type ThemeMode } from '@/lib/theme-storage';

type ThemeModeContextValue = {
  activeTheme: ThemeMode;
  setThemeMode: (theme: ThemeMode) => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: PropsWithChildren) {
  const systemTheme = useSystemColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>(systemTheme === 'dark' ? 'dark' : 'light');
  const [hasHydratedThemeMode, setHasHydratedThemeMode] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function hydrateThemeMode() {
      const persistedThemeMode = await loadPersistedThemeMode();

      if (isMounted && persistedThemeMode) {
        setThemeMode(persistedThemeMode);
      }

      if (isMounted) {
        setHasHydratedThemeMode(true);
      }
    }

    void hydrateThemeMode();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedThemeMode) {
      return;
    }

    void persistThemeMode(themeMode);
  }, [hasHydratedThemeMode, themeMode]);

  const value = useMemo(
    () => ({
      activeTheme: themeMode,
      setThemeMode,
    }),
    [themeMode],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }

  return context;
}
