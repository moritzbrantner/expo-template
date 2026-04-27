import { Link, useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActionButton, InlineMessage, ScreenScroll, SectionCard, StatPill } from '@/components/social/ui';
import { ThemedText } from '@/components/themed-text';
import { useActivityQuery, useDiscoverProfiles, useFollowMutation } from '@/lib/social-hooks';
import { useAuth } from '@/providers/auth-provider';

export default function HomeScreen() {
  const router = useRouter();
  const { currentUser, signOut } = useAuth();
  const discoverQuery = useDiscoverProfiles('');
  const activityQuery = useActivityQuery();
  const suggestedProfiles = discoverQuery.data?.profiles.slice(0, 3) ?? [];
  const recentFollowers =
    activityQuery.data?.activity.filter((item) => item.type === 'followed_you').slice(0, 3) ?? [];
  const completeness = [
    currentUser?.displayName ? 1 : 0,
    currentUser?.username ? 1 : 0,
    currentUser?.avatarUrl ? 1 : 0,
  ].reduce((total, value) => total + value, 0);

  return (
    <ScreenScroll
      title="Home"
      description="A lightweight dashboard for profile completeness, suggested follows, recent follower activity, and quick routes into the rest of the app.">
      <SectionCard>
        <ThemedText type="subtitle">Session</ThemedText>
        <ThemedText testID="session-status">Signed in as {currentUser?.email}</ThemedText>
        <ActionButton label="Sign out" onPress={() => void signOut()} testID="signout-button" />
      </SectionCard>

      <SectionCard>
        <ThemedText type="subtitle">Profile completeness</ThemedText>
        <View style={styles.row}>
          <StatPill label="of 3 basics" value={completeness} />
          <StatPill label="ready" value={completeness === 3 ? 'yes' : 'in progress'} />
        </View>
        <ActionButton label="Edit account" onPress={() => router.push('/settings/account' as Href)} />
      </SectionCard>

      <SectionCard>
        <ThemedText type="subtitle">Suggested follows</ThemedText>
        {discoverQuery.isPending ? (
          <InlineMessage tone="muted" message="Loading suggestions..." />
        ) : discoverQuery.isError ? (
          <InlineMessage
            tone="error"
            message={discoverQuery.error instanceof Error ? discoverQuery.error.message : 'Unable to load suggestions.'}
          />
        ) : suggestedProfiles.length === 0 ? (
          <InlineMessage tone="muted" message="No suggested profiles right now." />
        ) : (
          suggestedProfiles.map((profile) => (
            <SuggestedProfileRow
              key={profile.id}
              username={profile.username}
              displayName={profile.displayName}
              isFollowing={profile.relationship?.isFollowing ?? false}
            />
          ))
        )}
      </SectionCard>

      <SectionCard>
        <ThemedText type="subtitle">Recent followers</ThemedText>
        {activityQuery.isPending ? (
          <InlineMessage tone="muted" message="Loading activity..." />
        ) : activityQuery.isError ? (
          <InlineMessage
            tone="error"
            message={activityQuery.error instanceof Error ? activityQuery.error.message : 'Unable to load activity.'}
          />
        ) : recentFollowers.length === 0 ? (
          <InlineMessage tone="muted" message="No one has followed you yet." />
        ) : (
          recentFollowers.map((item) => (
            <Link key={`${item.type}-${item.profile.id}-${item.createdAt}`} href={`/u/${item.profile.username}` as Href}>
              @{item.profile.username} followed you
            </Link>
          ))
        )}
      </SectionCard>

      <SectionCard>
        <ThemedText type="subtitle">Quick links</ThemedText>
        <ActionButton label="Open Discover" onPress={() => router.push('/discover' as Href)} />
        <ActionButton label="Open Activity" onPress={() => router.push('/activity' as Href)} variant="secondary" />
        <ActionButton label="Open Settings" onPress={() => router.push('/settings' as Href)} variant="secondary" />
      </SectionCard>
    </ScreenScroll>
  );
}

function SuggestedProfileRow({
  username,
  displayName,
  isFollowing,
}: {
  username: string;
  displayName: string;
  isFollowing: boolean;
}) {
  const router = useRouter();
  const followMutation = useFollowMutation(username);

  return (
    <View style={styles.suggestedRow}>
      <View style={styles.suggestedCopy}>
        <ThemedText type="defaultSemiBold">{displayName}</ThemedText>
        <ThemedText>@{username}</ThemedText>
      </View>
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
        onPress={() => void followMutation.mutateAsync(!isFollowing)}
        disabled={followMutation.isPending}
      />
      <ActionButton label="View" onPress={() => router.push(`/u/${username}` as Href)} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  suggestedRow: {
    gap: 10,
  },
  suggestedCopy: {
    gap: 4,
  },
});
