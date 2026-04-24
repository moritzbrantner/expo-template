import { Redirect, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { protectedStackDescriptors } from '@/lib/navigation';
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
      {protectedStackDescriptors.map((descriptor) => (
        <Stack.Screen
          key={descriptor.name}
          name={descriptor.name}
          options={
            descriptor.name === '(tabs)'
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
