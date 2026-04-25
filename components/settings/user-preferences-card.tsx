import { StyleSheet, View } from 'react-native';

import { SectionCard } from '@/components/social/ui';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { UserPreferenceSnapshot } from '@/lib/user-preferences';

export function UserPreferencesCard({ preferences }: { preferences: UserPreferenceSnapshot }) {
  const mutedTextColor = useThemeColor({}, 'mutedText');

  return (
    <SectionCard>
      <ThemedText type="subtitle">Detected device preferences</ThemedText>
      <ThemedText style={{ color: mutedTextColor }}>
        These values come from the current device theme, accessibility, and locale settings.
      </ThemedText>
      <View style={styles.preferenceList}>
        <PreferenceRow
          label="Theme preference"
          value={preferences.preferredTheme === 'dark' ? 'Dark' : 'Light'}
        />
        <PreferenceRow
          label="Color-blind support"
          value={preferences.colorBlindModeEnabled ? 'Enabled' : 'Not detected'}
        />
        <PreferenceRow label="Language" value={preferences.language} />
      </View>
    </SectionCard>
  );
}

function PreferenceRow({ label, value }: { label: string; value: string }) {
  const mutedTextColor = useThemeColor({}, 'mutedText');

  return (
    <View style={styles.preferenceRow}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <ThemedText style={{ color: mutedTextColor }}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  preferenceList: {
    gap: 10,
  },
  preferenceRow: {
    gap: 4,
  },
});
