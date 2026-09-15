import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';

export default function ProtectedLayout() {
  const { currentUser } = useAuth();

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
