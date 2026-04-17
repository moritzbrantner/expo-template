import { Link, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile-avatar';
import { ActionButton, InlineMessage, ScreenScroll, SectionCard, StatPill } from '@/components/social/ui';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFollowMutation, useProfileQuery } from '@/lib/social-hooks';
import { useAuth } from '@/providers/auth-provider';

export default function PublicProfileScreen() {
  const router = useRouter();
  const mutedTextColor = useThemeColor({}, 'mutedText');
  const borderColor = useThemeColor({}, 'border');
  const { username } = useLocalSearchParams<{ username?: string | string[] }>();
  const profileUsername = Array.isArray(username) ? username[0] : username;
  const { currentUser } = useAuth();
  const profileQuery = useProfileQuery(profileUsername);
  const followMutation = useFollowMutation(profileUsername ?? '');

  const profile = profileQuery.data?.profile;
  const canFollow = Boolean(profile && !profile.isSelf);
  const isFollowing = profile?.relationship?.isFollowing ?? false;

  function handleFollowPress() {
    if (!profile) {
      return;
    }

    if (!currentUser) {
      router.push('/auth/sign-in');
      return;
    }

    void followMutation.mutateAsync(!isFollowing);
  }

  return (
    <ScreenScroll
      title={profile ? profile.displayName : 'Profile'}
      description="Public profiles are readable without signing in. Follow actions require authentication.">
      {profileQuery.isPending ? (
        <InlineMessage tone="muted" message="Loading profile..." />
      ) : profileQuery.isError ? (
        <InlineMessage
          tone="error"
          message={profileQuery.error instanceof Error ? profileQuery.error.message : 'Unable to load this profile.'}
        />
      ) : !profile ? (
        <InlineMessage tone="muted" message="This profile could not be found." />
      ) : (
        <>
          <SectionCard>
            <View style={styles.headerRow} testID="profile-detail-card">
              <ProfileAvatar
                name={profile.displayName}
                uri={profile.avatarUrl}
                size={84}
                borderColor={borderColor}
              />
              <View style={styles.headerCopy}>
                <ThemedText type="subtitle">{profile.displayName}</ThemedText>
                <ThemedText style={{ color: mutedTextColor }}>@{profile.username}</ThemedText>
                <ThemedText style={{ color: mutedTextColor }}>
                  Joined {new Date(profile.createdAt).toLocaleDateString()}
                </ThemedText>
              </View>
            </View>
            <ThemedText>{profile.bio || 'This profile has not added a bio yet.'}</ThemedText>
            <View style={styles.statsRow}>
              <StatPill label="followers" value={profile.followerCount} />
              <StatPill label="following" value={profile.followingCount} />
            </View>
            {profile.isSelf ? (
              <ActionButton label="Edit your account" onPress={() => router.push('/settings/account' as Href)} />
            ) : canFollow ? (
              <ActionButton
                label={
                  followMutation.isPending
                    ? isFollowing
                      ? 'Unfollowing...'
                      : 'Following...'
                    : isFollowing
                      ? 'Unfollow'
                      : 'Follow'
                }
                onPress={handleFollowPress}
                disabled={followMutation.isPending}
                testID="profile-follow-button"
              />
            ) : null}
            {!currentUser && canFollow ? (
              <ThemedText style={{ color: mutedTextColor }}>
                Guests can browse profiles, but following routes through sign-in first.
              </ThemedText>
            ) : null}
          </SectionCard>

          <SectionCard>
            <ThemedText type="subtitle">Quick links</ThemedText>
            <Link href={'/auth/sign-in' as Href} style={styles.linkText}>
              Sign in
            </Link>
            <Link href={'/auth/sign-up' as Href} style={styles.linkText}>
              Create an account
            </Link>
          </SectionCard>
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  linkText: {
    fontSize: 16,
  },
});
