import { Redirect, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/providers/auth-provider';

export default function ProtectedLayout() {
  const { currentUser, isHydrating } = useAuth();

  if (isHydrating) {
    return (
      <ThemedView style={styles.centered}>
        <View style={styles.loadingCard}>
          <ThemedText>Restoring your session...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!currentUser) {
    return <Redirect href="/auth/sign-in" />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
      <Stack.Screen name="settings/account" options={{ title: 'Account' }} />
      <Stack.Screen name="settings/admin" options={{ title: 'Admin' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingCard: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
});
