/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#5b6a7f';
const tintColorDark = '#c6d2e0';

export const Colors = {
  light: {
    text: '#17191e',
    mutedText: '#67707d',
    background: '#f7f8fb',
    surface: 'rgba(255, 255, 255, 0.72)',
    tint: tintColorLight,
    accent: tintColorLight,
    accentSurface: 'rgba(91, 106, 127, 0.12)',
    border: 'rgba(112, 124, 142, 0.2)',
    icon: '#7a8492',
    tabIconDefault: '#7a8492',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#f4f6f8',
    mutedText: '#aab3bf',
    background: '#232932',
    surface: 'rgba(50, 58, 70, 0.78)',
    tint: tintColorDark,
    accent: tintColorDark,
    accentSurface: 'rgba(198, 210, 224, 0.14)',
    border: 'rgba(236, 237, 238, 0.14)',
    icon: '#8f99a8',
    tabIconDefault: '#8f99a8',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
