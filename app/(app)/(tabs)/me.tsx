import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile-avatar';
import { ActionButton, InlineMessage, ScreenScroll, SectionCard, StatPill } from '@/components/social/ui';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useProfileQuery } from '@/lib/social-hooks';
import { useAuth } from '@/providers/auth-provider';

export default function MeScreen() {
  const router = useRouter();
  const borderColor = useThemeColor({}, 'border');
  const mutedTextColor = useThemeColor({}, 'mutedText');
  const { currentUser, hasPermission } = useAuth();
  const profileQuery = useProfileQuery(currentUser?.username);
  const profile = profileQuery.data?.profile;

  return (
    <ScreenScroll
      title="Me"
      description="Your current public profile, counts, and the fastest route into account and admin settings.">
      {profileQuery.isPending ? (
        <InlineMessage tone="muted" message="Loading your profile..." />
      ) : profileQuery.isError ? (
        <InlineMessage
          tone="error"
          message={profileQuery.error instanceof Error ? profileQuery.error.message : 'Unable to load your profile.'}
        />
      ) : !profile ? (
        <InlineMessage tone="muted" message="Your profile is not available." />
      ) : (
        <SectionCard>
          <View style={styles.headerRow}>
            <ProfileAvatar
              name={profile.displayName}
              uri={profile.avatarUrl}
              size={84}
              borderColor={borderColor}
            />
            <View style={styles.headerCopy}>
              <ThemedText type="subtitle">{profile.displayName}</ThemedText>
              <ThemedText style={{ color: mutedTextColor }}>@{profile.username}</ThemedText>
              <ThemedText style={{ color: mutedTextColor }}>{currentUser?.email}</ThemedText>
            </View>
          </View>
          <ThemedText>{profile.bio || 'Add a bio from Account settings.'}</ThemedText>
          <View style={styles.statsRow}>
            <StatPill label="followers" value={profile.followerCount} />
            <StatPill label="following" value={profile.followingCount} />
            <StatPill label="role" value={profile.role} />
          </View>
          <ActionButton label="Edit account" onPress={() => router.push('/settings/account' as Href)} />
          <ActionButton label="Open settings" onPress={() => router.push('/settings')} variant="secondary" />
          {hasPermission('role.manage:any') ? (
            <ActionButton label="Open admin" onPress={() => router.push('/settings/admin' as Href)} variant="secondary" />
          ) : null}
        </SectionCard>
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
});
