import { createContext, PropsWithChildren, useContext, useMemo } from 'react';

import { TOUCH_INTERACTION_POLICY } from '@/lib/touch-interactions';

export type TouchPalette = {
  accent: string;
  accentText: string;
  surface: string;
  elevatedSurface: string;
  border: string;
  text: string;
  mutedText: string;
  danger: string;
};

export type TouchInteractionConfig = {
  hapticsEnabled: boolean;
  minimumTargetSize: number;
  palette: TouchPalette;
};

const defaultPalette: TouchPalette = {
  accent: '#2563EB',
  accentText: '#FFFFFF',
  surface: '#FFFFFF',
  elevatedSurface: '#F3F4F6',
  border: '#D1D5DB',
  text: '#111827',
  mutedText: '#6B7280',
  danger: '#B91C1C',
};

const defaultConfig: TouchInteractionConfig = {
  hapticsEnabled: true,
  minimumTargetSize: TOUCH_INTERACTION_POLICY.minimumTargetSize,
  palette: defaultPalette,
};

const TouchInteractionContext = createContext<TouchInteractionConfig>(defaultConfig);

type TouchInteractionProviderProps = PropsWithChildren<{
  config?: Partial<Omit<TouchInteractionConfig, 'palette'>> & {
    palette?: Partial<TouchPalette>;
  };
}>;

export function TouchInteractionProvider({ children, config }: TouchInteractionProviderProps) {
  const value = useMemo<TouchInteractionConfig>(
    () => ({
      hapticsEnabled: config?.hapticsEnabled ?? defaultConfig.hapticsEnabled,
      minimumTargetSize: config?.minimumTargetSize ?? defaultConfig.minimumTargetSize,
      palette: {
        ...defaultPalette,
        ...config?.palette,
      },
    }),
    [config],
  );

  return <TouchInteractionContext.Provider value={value}>{children}</TouchInteractionContext.Provider>;
}

export function useTouchInteractionConfig() {
  return useContext(TouchInteractionContext);
}
