import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TouchInteractionsShowcase } from '@/components/touch-interactions-showcase';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/hooks/theme-mode';
import { useAuth } from '@/providers/auth-provider';

export default function ControlsShowcase() {
  const router = useRouter();
  const { currentUser, isHydrating, signOut } = useAuth();
  const { activeTheme } = useThemeMode();
  const palette = Colors[activeTheme];
  const sessionStatus = isHydrating
    ? 'Restoring session...'
    : currentUser
      ? `Signed in as ${currentUser.email}`
      : 'No active session.';

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}>
      <View
        style={[
          styles.sessionCard,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
        ]}>
        <View style={styles.sessionCopy}>
          <ThemedText style={styles.sessionEyebrow}>Authentication</ThemedText>
          <ThemedText type="subtitle">Session status</ThemedText>
          <ThemedText testID="session-status">{sessionStatus}</ThemedText>
        </View>
        {currentUser ? (
          <Pressable
            accessibilityRole="button"
            style={[styles.sessionButton, { backgroundColor: '#8A1C1C' }]}
            testID="signout-button"
            onPress={signOut}>
            <ThemedText style={styles.sessionButtonText}>Sign out</ThemedText>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={[styles.sessionButton, { backgroundColor: palette.accent }]}
            onPress={() => router.push('/auth/sign-in')}>
            <ThemedText style={styles.sessionButtonText}>Sign in</ThemedText>
          </Pressable>
        )}
      </View>

      <View
        style={[
          styles.hero,
          {
            backgroundColor: activeTheme === 'dark' ? '#102029' : '#F7F3EC',
            borderColor: palette.border,
          },
        ]}>
        <ThemedText style={styles.eyebrow}>Native touch control study</ThemedText>
        <ThemedText type="title" style={styles.title}>
          Interaction primitives designed for fingers, not cursors.
        </ThemedText>
        <ThemedText style={[styles.copy, { color: palette.mutedText }]}>
          The native showcase exercises reusable one-finger and two-finger interactions. Web keeps its
          separate Motion-based control study.
        </ThemedText>
      </View>

      <TouchInteractionsShowcase />
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
    paddingBottom: 56,
  },
  sessionCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  sessionCopy: {
    gap: 6,
  },
  sessionEyebrow: {
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  sessionButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
  },
  sessionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
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
});
