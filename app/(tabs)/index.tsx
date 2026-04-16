import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/hooks/theme-mode';
import { useAuth } from '@/providers/auth-provider';

export default function HomeScreen() {
  const router = useRouter();
  const { activeTheme } = useThemeMode();
  const palette = Colors[activeTheme];
  const { currentUser, isHydrating, signOut } = useAuth();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      testID="home-screen">
      <View
        style={[
          styles.hero,
          {
            backgroundColor: activeTheme === 'dark' ? '#0D1B22' : '#EAF6FB',
            borderColor: palette.border,
          },
        ]}>
        <ThemedText type="title">Authentication playground</ThemedText>
        <ThemedText style={{ color: palette.mutedText }}>
          The app now includes standalone signup and signin routes backed by a local auth API and
          Mailpit for email capture.
        </ThemedText>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="link"
            style={[styles.primaryButton, { backgroundColor: palette.accent }]}
            testID="home-signup-link"
            onPress={() => router.push('/auth/sign-up')}>
            <ThemedText style={styles.primaryButtonLabel}>Create account</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            style={[
              styles.secondaryButton,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
            testID="home-signin-link"
            onPress={() => router.push('/auth/sign-in')}>
            <ThemedText type="defaultSemiBold">Sign in</ThemedText>
          </Pressable>
        </View>
      </View>
      <ThemedView
        style={[
          styles.statusCard,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
        ]}>
        <ThemedText type="subtitle">Session state</ThemedText>
        {isHydrating ? (
          <>
            <ThemedText testID="session-status">Restoring session...</ThemedText>
            <ThemedText style={{ color: palette.mutedText }}>
              Loading the last authenticated session from device storage.
            </ThemedText>
          </>
        ) : currentUser ? (
          <>
            <ThemedText testID="session-status">
              Signed in as <ThemedText type="defaultSemiBold">{currentUser.email}</ThemedText>
            </ThemedText>
            <ThemedText style={{ color: palette.mutedText }}>
              Welcome back, {currentUser.name}.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              style={[styles.secondaryButton, { borderColor: palette.border }]}
              testID="signout-button"
              onPress={signOut}>
              <ThemedText type="defaultSemiBold">Sign out</ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <ThemedText testID="session-status">No active session.</ThemedText>
            <ThemedText style={{ color: palette.mutedText }}>
              Sign up first, then sign in to see the authenticated state here.
            </ThemedText>
          </>
        )}
      </ThemedView>
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
    gap: 14,
    borderWidth: 1,
    borderRadius: 28,
    padding: 24,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  primaryButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusCard: {
    gap: 10,
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },
});
