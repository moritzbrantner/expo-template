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
          headerTitle: 'Feeding',
          headerTitleAlign: 'left',
          headerTitleStyle: { color: '#332c29', fontSize: 22, fontWeight: '800' },
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 10 }}>
              <Link href="/log" asChild>
                <Pressable
                  accessibilityLabel="Open feeding log"
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 14,
                    backgroundColor: '#efe5df',
                    opacity: pressed ? 0.65 : 1,
                  })}>
                  <Text style={{ fontSize: 19, lineHeight: 22 }}>📋</Text>
                </Pressable>
              </Link>
              <Link href="/share" asChild>
                <Pressable
                  accessibilityLabel="Share feeding log"
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    minWidth: 56,
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 14,
                    backgroundColor: '#3f5b4d',
                    paddingHorizontal: 10,
                    opacity: pressed ? 0.65 : 1,
                  })}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Share</Text>
                </Pressable>
              </Link>
              <Link href="/stats" asChild>
                <Pressable
                  accessibilityLabel="Open stats"
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 14,
                    backgroundColor: '#efe5df',
                    opacity: pressed ? 0.65 : 1,
                  })}>
                  <Text style={{ fontSize: 19, lineHeight: 22 }}>📊</Text>
                </Pressable>
              </Link>
              <Link href="/settings" asChild>
                <Pressable
                  accessibilityLabel="Open settings"
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 14,
                    backgroundColor: '#efe5df',
                    opacity: pressed ? 0.65 : 1,
                  })}>
                  <Text style={{ fontSize: 21, lineHeight: 24 }}>⚙️</Text>
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <Stack.Screen name="log" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="stats" options={{ headerShown: false }} />
      <Stack.Screen name="bottles" options={{ headerShown: false }} />
      <Stack.Screen name="pumping-gear" options={{ headerShown: false }} />
      <Stack.Screen name="share" options={{ headerShown: false }} />
    </Stack>
  );
}