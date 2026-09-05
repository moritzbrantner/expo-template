import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, Stack, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';

import { deserializeFeedingLog } from '../lib/feeding';
import {
  BABY_FEEDING_STORAGE_KEY,
  decodeSharedFeedingLog,
  feedingLogsEqual,
} from '../lib/sharing';

function normalizedParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ state?: string | string[] }>();
  const incomingState = normalizedParam(params.state);

  useEffect(() => {
    if (pathname !== '/' || !incomingState) return;

    let active = true;
    const shared = decodeSharedFeedingLog(incomingState);
    if (!shared) {
      router.replace('/share?invalid=1');
      return;
    }

    void AsyncStorage.getItem(BABY_FEEDING_STORAGE_KEY)
      .then(async (stored) => {
        if (!active) return;
        const current = deserializeFeedingLog(stored);

        if (current.entries.length === 0 || feedingLogsEqual(current, shared)) {
          await AsyncStorage.setItem(BABY_FEEDING_STORAGE_KEY, JSON.stringify(shared));
          if (active) router.replace('/');
          return;
        }

        router.replace({ pathname: '/share', params: { state: incomingState } });
      })
      .catch(() => {
        if (active) router.replace('/share?invalid=1');
      });

    return () => {
      active = false;
    };
  }, [incomingState, pathname, router]);

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerBackVisible: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#f7f2ee' },
          headerTitle: '',
          headerRight: () => (
            <Link href="/share" asChild>
              <Pressable
                accessibilityLabel="Share feeding log"
                accessibilityRole="button"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 8 })}>
                <Text style={{ color: '#3f5b4d', fontSize: 14, fontWeight: '800' }}>Share</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <Stack.Screen name="share" options={{ headerShown: false }} />
    </Stack>
  );
}
