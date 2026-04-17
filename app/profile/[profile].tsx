import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileAvatar } from '@/components/profile-avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ApiRequestError, fetchUserRequest, type AuthUser } from '@/lib/auth';

type ProfileState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not-found' }
  | { status: 'success'; user: AuthUser };

export default function ProfileScreen() {
  const borderColor = useThemeColor({}, 'border');
  const mutedTextColor = useThemeColor({}, 'mutedText');
  const { profile } = useLocalSearchParams<{ profile?: string | string[] }>();
  const userId = Array.isArray(profile) ? profile[0] : profile;
  const [profileState, setProfileState] = useState<ProfileState>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;

    async function loadUserProfile() {
      if (!userId) {
        if (isMounted) {
          setProfileState({ status: 'not-found' });
        }
        return;
      }

      setProfileState({ status: 'loading' });

      try {
        const response = await fetchUserRequest(userId);

        if (isMounted) {
          setProfileState({
            status: 'success',
            user: response.user,
          });
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiRequestError && error.status === 404) {
          setProfileState({ status: 'not-found' });
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to load this profile.';
        setProfileState({ status: 'error', message });
      }
    }

    void loadUserProfile();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return (
    <ThemedView style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {profileState.status === 'loading' ? (
            <ThemedView
              style={[styles.card, { borderColor }]}
              lightColor={Colors.light.surface}
              darkColor={Colors.dark.surface}>
              <ThemedText type="subtitle">Loading profile</ThemedText>
              <ThemedText style={{ color: mutedTextColor }}>
                Fetching user details from the auth API.
              </ThemedText>
            </ThemedView>
          ) : profileState.status === 'error' ? (
            <ThemedView
              style={[styles.card, { borderColor }]}
              lightColor={Colors.light.surface}
              darkColor={Colors.dark.surface}>
              <ThemedText type="subtitle">Profile unavailable</ThemedText>
              <ThemedText style={{ color: mutedTextColor }}>{profileState.message}</ThemedText>
            </ThemedView>
          ) : profileState.status === 'not-found' ? (
            <ThemedView
              style={[styles.card, { borderColor }]}
              lightColor={Colors.light.surface}
              darkColor={Colors.dark.surface}>
              <ThemedText type="subtitle">Profile not found</ThemedText>
              <ThemedText style={{ color: mutedTextColor }}>
                This route expects a live auth-api user id such as `/profile/1234abcd`.
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              <ThemedView
                testID="profile-detail-card"
                style={[styles.hero, { borderColor }]}
                lightColor={Colors.light.surface}
                darkColor={Colors.dark.surface}>
                <View style={styles.heroTopRow}>
                  <ProfileAvatar
                    name={profileState.user.name}
                    uri={profileState.user.avatarUrl}
                    size={88}
                    borderColor={borderColor}
                  />
                  <View style={styles.heroCopy}>
                    <ThemedText style={[styles.eyebrow, { color: mutedTextColor }]}>
                      Auth user
                    </ThemedText>
                    <ThemedText type="title">{profileState.user.name}</ThemedText>
                    <ThemedText style={[styles.meta, { color: mutedTextColor }]}>
                      {profileState.user.email}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.bio}>User id: {profileState.user.id}</ThemedText>
              </ThemedView>

              <ThemedView
                style={[styles.card, { borderColor }]}
                lightColor={Colors.light.surface}
                darkColor={Colors.dark.surface}>
                <ThemedText type="subtitle">Overview</ThemedText>
                <ThemedText>Email: {profileState.user.email}</ThemedText>
                <ThemedText style={{ color: mutedTextColor }}>Created at</ThemedText>
                <ThemedText style={styles.about}>
                  {new Date(profileState.user.createdAt).toLocaleString()}
                </ThemedText>
              </ThemedView>

              <ThemedView
                style={[styles.card, { borderColor }]}
                lightColor={Colors.light.surface}
                darkColor={Colors.dark.surface}>
                <ThemedText type="subtitle">Route contract</ThemedText>
                <ThemedText style={{ color: mutedTextColor }}>
                  This screen resolves `GET /users/:id` from `EXPO_PUBLIC_AUTH_API_URL`.
                </ThemedText>
              </ThemedView>
            </>
          )}

          <Link href="/communication" style={[styles.backLink, { borderColor }]}>
            <ThemedText type="defaultSemiBold">Back to communication</ThemedText>
          </Link>
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
  hero: {
    gap: 10,
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    fontSize: 12,
  },
  meta: {
    fontSize: 16,
  },
  bio: {
    lineHeight: 24,
  },
  card: {
    gap: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  about: {
    lineHeight: 22,
  },
  backLink: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
});
