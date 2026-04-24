import { type ReactNode } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeMode } from '@/hooks/theme-mode';
import { Colors, Fonts } from '@/constants/theme';

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  footerPrompt: string;
  footerLabel: string;
  footerHref: Href;
  children: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  footerPrompt,
  footerLabel,
  footerHref,
  children,
}: AuthShellProps) {
  const router = useRouter();
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
            backgroundColor: palette.accentSurface,
            borderColor: palette.border,
          },
        ]}>
        <View style={styles.heroCopy}>
          <ThemedText style={[styles.eyebrow, { color: palette.accent }]}>{eyebrow}</ThemedText>
          <ThemedText style={[styles.title, { fontFamily: Fonts.rounded }]}>{title}</ThemedText>
          <ThemedText style={[styles.description, { color: palette.mutedText }]}>
            {description}
          </ThemedText>
        </View>
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}>
          {children}
          <View style={styles.footer}>
            <ThemedText style={{ color: palette.mutedText }}>{footerPrompt}</ThemedText>
            <Pressable
              accessibilityRole="link"
              testID="auth-switch-link"
              onPress={() => router.push(footerHref)}>
              <ThemedText type="defaultSemiBold" style={{ color: palette.accent }}>
                {footerLabel}
              </ThemedText>
            </Pressable>
          </View>
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
    flexGrow: 1,
    padding: 20,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  heroCopy: {
    gap: 10,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 40,
  },
  description: {
    maxWidth: 460,
  },
  card: {
    gap: 18,
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
});
