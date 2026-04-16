import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { fetchUsersRequest, type AuthUser } from '@/lib/auth';
import { useAuth } from '@/providers/auth-provider';

const communicationSections = [
  {
    title: 'Websockets',
    description:
      'Websockets keep a persistent connection open so clients can receive low-latency updates like chat messages, presence, and shared cursor movement.',
    bullets: [
      'Use them when the product needs fast bidirectional events.',
      'The mobile client usually needs reconnect, heartbeat, and auth refresh logic.',
      'Small event payloads are easier to merge into visible state on constrained networks.',
    ],
  },
  {
    title: 'CRDTs',
    description:
      'CRDTs allow multiple devices to update shared state concurrently and still converge without server-enforced locking.',
    bullets: [
      'Useful when collaboration must continue during offline or unstable periods.',
      'The app usually persists local operations first, then syncs them later.',
      'Merge behavior lives in the data model instead of being scattered across UI code.',
    ],
  },
];

async function loadServerUsers({
  setIsLoadingUsers,
  setUsersError,
  setServerUsers,
}: {
  setIsLoadingUsers: (value: boolean) => void;
  setUsersError: (value: string | null) => void;
  setServerUsers: (value: AuthUser[]) => void;
}) {
  try {
    setIsLoadingUsers(true);
    setUsersError(null);
    const response = await fetchUsersRequest();
    setServerUsers(response.users);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load users.';
    setUsersError(message);
  } finally {
    setIsLoadingUsers(false);
  }
}

export default function CommunicationScreen() {
  const borderColor = useThemeColor({}, 'border');
  const mutedTextColor = useThemeColor({}, 'mutedText');
  const { currentUser } = useAuth();
  const [serverUsers, setServerUsers] = useState<AuthUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  useEffect(() => {
    void loadServerUsers({
      setIsLoadingUsers,
      setUsersError,
      setServerUsers,
    });
  }, []);

  const visibleUsers = currentUser
    ? serverUsers.filter((user) => user.id !== currentUser.id)
    : serverUsers;

  return (
    <ThemedView style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="title">Communication</ThemedText>
            <ThemedText style={{ color: mutedTextColor }}>
              This category groups the main primitives behind realtime collaboration on web,
              desktop, and mobile.
            </ThemedText>
          </ThemedView>

          <ThemedView
            style={[styles.card, { borderColor }]}
            lightColor={Colors.light.surface}
            darkColor={Colors.dark.surface}>
            <ThemedText style={[styles.eyebrow, { color: mutedTextColor }]}>
              API example
            </ThemedText>
            <ThemedText type="subtitle">Server users</ThemedText>
            <ThemedText style={{ color: mutedTextColor }}>
              The mobile app calls <ThemedText type="defaultSemiBold">GET /users</ThemedText> on
              the local Node API and renders public user data here.
            </ThemedText>
            {isLoadingUsers ? (
              <ThemedText style={{ color: mutedTextColor }}>
                Loading users from the server...
              </ThemedText>
            ) : usersError ? (
              <ThemedText style={{ color: mutedTextColor }}>{usersError}</ThemedText>
            ) : visibleUsers.length === 0 ? (
              <ThemedText style={{ color: mutedTextColor }}>
                No other users yet. Create another account to see it appear here.
              </ThemedText>
            ) : (
              visibleUsers.map((user) => (
                <ThemedView key={user.id} style={[styles.userRow, { borderColor }]}>
                  <ThemedText type="defaultSemiBold">{user.name}</ThemedText>
                  <ThemedText style={{ color: mutedTextColor }}>{user.email}</ThemedText>
                  <ThemedText style={{ color: mutedTextColor }}>
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                  </ThemedText>
                </ThemedView>
              ))
            )}
            <Pressable
              style={[styles.reloadButton, { borderColor }]}
              onPress={() =>
                void loadServerUsers({
                  setIsLoadingUsers,
                  setUsersError,
                  setServerUsers,
                })
              }>
              <ThemedText type="defaultSemiBold">Reload users</ThemedText>
            </Pressable>
          </ThemedView>

          {communicationSections.map((section) => (
            <ThemedView
              key={section.title}
              style={[styles.card, { borderColor }]}
              lightColor={Colors.light.surface}
              darkColor={Colors.dark.surface}>
              <ThemedText style={[styles.eyebrow, { color: mutedTextColor }]}>
                Communication topic
              </ThemedText>
              <ThemedText type="subtitle">{section.title}</ThemedText>
              <ThemedText style={{ color: mutedTextColor }}>{section.description}</ThemedText>
              {section.bullets.map((bullet) => (
                <ThemedText key={bullet} style={{ color: mutedTextColor }}>
                  • {bullet}
                </ThemedText>
              ))}
            </ThemedView>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 20,
  },
  header: {
    gap: 10,
  },
  card: {
    gap: 10,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  userRow: {
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  reloadButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 12,
  },
});
