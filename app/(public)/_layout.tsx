import { Redirect, Stack, usePathname, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/providers/auth-provider';

export default function PublicLayout() {
  const pathname = usePathname();
  const { currentUser, isHydrating } = useAuth();

  if (isHydrating) {
    return (
      <ThemedView style={styles.centered}>
        <View style={styles.loadingCard}>
          <ThemedText testID="auth-hydrating-message">Restoring your session...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (currentUser && !pathname.startsWith('/u/')) {
    return <Redirect href={'/(app)' as Href} />;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="u/[username]" options={{ title: 'Profile' }} />
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
