import { Redirect, Stack, usePathname, type Href } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';

export default function PublicLayout() {
  const pathname = usePathname();
  const { currentUser } = useAuth();

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
