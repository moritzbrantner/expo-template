import { Redirect, Stack, usePathname, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { publicStackDescriptors } from '@/lib/navigation';
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
      {publicStackDescriptors.map((descriptor) => (
        <Stack.Screen
          key={descriptor.name}
          name={descriptor.name}
          options={
            descriptor.name === 'index' || descriptor.name === 'auth'
              ? { headerShown: false }
              : {
                  title: descriptor.title,
                  presentation: descriptor.presentation,
                }
          }
        />
      ))}
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
