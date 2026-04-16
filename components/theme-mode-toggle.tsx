import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useThemeMode } from '@/hooks/theme-mode';

export function ThemeModeToggle() {
  const { activeTheme, setThemeMode } = useThemeMode();
  const borderColor = useThemeColor({}, 'border');
  const activeBorderColor = useThemeColor({}, 'accent');
  const activeBackgroundColor = useThemeColor({}, 'accentSurface');
  const mutedTextColor = useThemeColor({}, 'mutedText');

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle">Theme</ThemedText>
      <ThemedText style={[styles.description, { color: mutedTextColor }]}>
        Switch between light and dark appearance for the mobile app.
      </ThemedText>
      <ThemedText
        testID="theme-mode-status"
        style={[styles.description, { color: mutedTextColor }]}>
        Saved preference: {activeTheme === 'dark' ? 'Dark' : 'Light'}
      </ThemedText>
      <View style={styles.buttonRow}>
        <Pressable
          testID="theme-mode-light"
          accessibilityRole="button"
          style={[
            styles.button,
            { borderColor },
            activeTheme === 'light' && {
              borderColor: activeBorderColor,
              backgroundColor: activeBackgroundColor,
            },
          ]}
          onPress={() => setThemeMode('light')}>
          <ThemedText style={styles.buttonLabel}>Light</ThemedText>
        </Pressable>
        <Pressable
          testID="theme-mode-dark"
          accessibilityRole="button"
          style={[
            styles.button,
            { borderColor },
            activeTheme === 'dark' && {
              borderColor: activeBorderColor,
              backgroundColor: activeBackgroundColor,
            },
          ]}
          onPress={() => setThemeMode('dark')}>
          <ThemedText style={styles.buttonLabel}>Dark</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  description: {
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
  },
});
