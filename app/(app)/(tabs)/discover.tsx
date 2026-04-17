import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ActionButton, InlineMessage, ScreenScroll, SectionCard, StatPill } from '@/components/social/ui';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useDiscoverProfiles, useFollowMutation } from '@/lib/social-hooks';

export default function DiscoverScreen() {
  const router = useRouter();
  const borderColor = useThemeColor({}, 'border');
  const mutedTextColor = useThemeColor({}, 'mutedText');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const [query, setQuery] = useState('');
  const profilesQuery = useDiscoverProfiles(query);

  return (
    <ScreenScroll
      title="Discover"
      description="Search public profiles, scan follow stats, and follow or unfollow with optimistic updates.">
      <SectionCard>
        <ThemedText type="subtitle">Search profiles</ThemedText>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Search by name, username, or bio"
          placeholderTextColor={mutedTextColor}
          style={[
            styles.searchInput,
            {
              borderColor,
              backgroundColor,
              color: textColor,
            },
          ]}
          testID="discover-search-input"
          value={query}
          onChangeText={setQuery}
        />
      </SectionCard>

      {profilesQuery.isPending ? (
        <InlineMessage tone="muted" message="Loading profiles..." />
      ) : profilesQuery.isError ? (
        <InlineMessage
          tone="error"
          message={profilesQuery.error instanceof Error ? profilesQuery.error.message : 'Unable to load profiles.'}
        />
      ) : (profilesQuery.data?.profiles.length ?? 0) === 0 ? (
        <InlineMessage tone="muted" message="No profiles match this search." />
      ) : (
        profilesQuery.data?.profiles.map((profile) => (
          <DiscoverCard
            key={profile.id}
            username={profile.username}
            displayName={profile.displayName}
            bio={profile.bio}
            followerCount={profile.followerCount}
            followingCount={profile.followingCount}
            isFollowing={profile.relationship?.isFollowing ?? false}
            onOpen={() => router.push(`/u/${profile.username}` as Href)}
          />
        ))
      )}
    </ScreenScroll>
  );
}

function DiscoverCard({
  username,
  displayName,
  bio,
  followerCount,
  followingCount,
  isFollowing,
  onOpen,
}: {
  username: string;
  displayName: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  onOpen: () => void;
}) {
  const followMutation = useFollowMutation(username);

  return (
    <SectionCard>
      <Pressable testID={`discover-user-${username}`} onPress={onOpen}>
        <ThemedText type="subtitle">{displayName}</ThemedText>
        <ThemedText>@{username}</ThemedText>
        <ThemedText>{bio || 'No bio yet.'}</ThemedText>
      </Pressable>
      <View style={styles.statsRow}>
        <StatPill label="followers" value={followerCount} />
        <StatPill label="following" value={followingCount} />
      </View>
      <View style={styles.actionRow}>
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
        <ActionButton label="View profile" onPress={onOpen} variant="secondary" />
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionRow: {
    gap: 10,
  },
});
