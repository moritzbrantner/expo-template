import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/hooks/theme-mode';

const suites = ['Lumen', 'Cascade', 'Velour'];

export default function ControlsShowcase() {
  const { activeTheme } = useThemeMode();
  const palette = Colors[activeTheme];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}>
      <View
        style={[
          styles.hero,
          {
            backgroundColor: activeTheme === 'dark' ? '#102029' : '#F7F3EC',
            borderColor: palette.border,
          },
        ]}>
        <ThemedText style={styles.eyebrow}>Motion.dev control study</ThemedText>
        <ThemedText type="title" style={styles.title}>
          Beautiful controls, tuned for the web.
        </ThemedText>
        <ThemedText style={[styles.copy, { color: palette.mutedText }]}>
          This route renders an interactive Motion DOM showcase on web. On native, it falls back to
          a static summary so the app still builds cleanly across platforms.
        </ThemedText>
        <View style={styles.actionRow}>
          <Pressable style={[styles.primaryButton, { backgroundColor: palette.accent }]}>
            <ThemedText style={styles.primaryButtonText}>Open on web</ThemedText>
          </Pressable>
          <View style={[styles.badge, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <ThemedText type="defaultSemiBold">{suites.join(' · ')}</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <ThemedText type="subtitle">What the web version includes</ThemedText>
          <ThemedText style={{ color: palette.mutedText }}>
            A magnetic launch button, a fluid power switch, a shared-layout segmented control, and
            an animated intensity mixer built with Motion.
          </ThemedText>
        </View>
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <ThemedText type="subtitle">Native fallback</ThemedText>
          <ThemedText style={{ color: palette.mutedText }}>
            The native screen stays lightweight and descriptive because Motion&apos;s DOM primitives
            are only used on web.
          </ThemedText>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 18,
    padding: 20,
  },
  hero: {
    borderRadius: 30,
    borderWidth: 1,
    gap: 14,
    padding: 24,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    lineHeight: 38,
  },
  copy: {
    maxWidth: 640,
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  primaryButton: {
    borderRadius: 999,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: '#08121A',
    fontWeight: '700',
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  grid: {
    gap: 16,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
});
