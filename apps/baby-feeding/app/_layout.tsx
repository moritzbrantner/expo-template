import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, Stack, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

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
          headerTitle: 'Feeding Log',
          headerTitleAlign: 'left',
          headerTitleStyle: { color: '#332c29', fontSize: 20, fontWeight: '800' },
          headerRight: () => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginRight: 12,
              }}>
              <Link href="/stats" asChild>
                <Pressable
                  accessibilityLabel="Open stats"
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    width: 38,
                    height: 38,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#fffaf7',
                    borderColor: '#ded0c9',
                    borderWidth: 1,
                    borderRadius: 13,
                    opacity: pressed ? 0.62 : 1,
                  })}>
                  <Text style={{ fontSize: 19, lineHeight: 23 }}>📊</Text>
                </Pressable>
              </Link>
              <Link href="/settings" asChild>
                <Pressable
                  accessibilityLabel="Open settings"
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    width: 38,
                    height: 38,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#fffaf7',
                    borderColor: '#ded0c9',
                    borderWidth: 1,
                    borderRadius: 13,
                    opacity: pressed ? 0.62 : 1,
                  })}>
                  <Text style={{ fontSize: 21, lineHeight: 24 }}>⚙️</Text>
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="stats" options={{ headerShown: false }} />
      <Stack.Screen name="share" options={{ headerShown: false }} />
    </Stack>
  );
}
