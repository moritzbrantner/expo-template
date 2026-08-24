import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { appFeatures } from '../app.features';
import { usePreferences } from '../core/preferences/preferences-provider';
import { createSettingsRegistry } from '../features/settings/settings-registry';

const themeModes = ['system', 'light', 'dark'] as const;
const locales = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
] as const;

export default function SettingsScreen() {
  const systemScheme = useColorScheme();
  const { preferences, setLocale, setThemeMode, t } = usePreferences();
  const dark = preferences.themeMode === 'dark' ||
    (preferences.themeMode === 'system' && systemScheme === 'dark');
  const palette = dark
    ? { background: '#101714', surface: '#19231f', text: '#f4f7f5', muted: '#a8b4af', accent: '#75d1b1' }
    : { background: '#f7f7f2', surface: '#ffffff', text: '#14231f', muted: '#66736e', accent: '#24765e' };
  const registry = createSettingsRegistry(appFeatures);

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('settings') }} />
      <Text style={[styles.title, { color: palette.text }]}>{t('settings')}</Text>

      {registry.some((entry) => entry.id === 'appearance') && (
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <Text style={[styles.label, { color: palette.text }]}>{t('theme')}</Text>
          <View style={styles.row}>
            {themeModes.map((mode) => (
              <Choice
                key={mode}
                label={t(mode)}
                selected={preferences.themeMode === mode}
                color={palette.accent}
                textColor={palette.text}
                onPress={() => setThemeMode(mode)}
              />
            ))}
          </View>
        </View>
      )}

      {registry.some((entry) => entry.id === 'language') && (
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <Text style={[styles.label, { color: palette.text }]}>{t('language')}</Text>
          <View style={styles.row}>
            {locales.map((locale) => (
              <Choice
                key={locale.value}
                label={locale.label}
                selected={preferences.locale === locale.value}
                color={palette.accent}
                textColor={palette.text}
                onPress={() => setLocale(locale.value)}
              />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function Choice({
  label,
  selected,
  color,
  textColor,
  onPress,
}: {
  label: string;
  selected: boolean;
  color: string;
  textColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, { borderColor: selected ? color : '#80908a' }]}>
      <Text style={{ color: selected ? color : textColor, fontWeight: selected ? '700' : '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 16, padding: 24 },
  title: { marginBottom: 8, fontSize: 34, fontWeight: '800' },
  card: { gap: 14, borderRadius: 18, padding: 18 },
  label: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
});
