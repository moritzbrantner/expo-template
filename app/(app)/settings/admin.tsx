import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActionButton, InlineMessage, ScreenScroll, SectionCard, StatPill } from '@/components/social/ui';
import { ThemedText } from '@/components/themed-text';
import { useAdminUsersQuery, useRoleMutation } from '@/lib/social-hooks';
import { useAuth } from '@/providers/auth-provider';

const ROLE_OPTIONS = ['member', 'moderator', 'admin'] as const;

export default function AdminSettingsScreen() {
  const { hasPermission, currentUser } = useAuth();
  const canManageRoles = hasPermission('role.manage:any');
  const usersQuery = useAdminUsersQuery(canManageRoles);
  const roleMutation = useRoleMutation();

  if (!canManageRoles) {
    return <Redirect href="/settings" />;
  }

  return (
    <ScreenScroll
      title="Admin"
      description="Admin-only role management backed by shared RBAC contracts and the local auth API.">
      {usersQuery.isPending ? (
        <InlineMessage tone="muted" message="Loading users..." />
      ) : usersQuery.isError ? (
        <InlineMessage
          tone="error"
          message={usersQuery.error instanceof Error ? usersQuery.error.message : 'Unable to load users.'}
        />
      ) : (usersQuery.data?.users.length ?? 0) === 0 ? (
        <InlineMessage tone="muted" message="No users available." />
      ) : (
        usersQuery.data?.users.map((user) => (
          <SectionCard key={user.id}>
            <ThemedText type="subtitle">{user.displayName}</ThemedText>
            <ThemedText>{user.email}</ThemedText>
            <ThemedText testID={`admin-role-${user.id}`}>Current role: {user.role}</ThemedText>
            <View style={styles.statsRow}>
              <StatPill label="role" value={user.role} />
              <StatPill label="followers" value={user.followerCount} />
              <StatPill label="following" value={user.followingCount} />
            </View>
            <View style={styles.buttonRow}>
              {ROLE_OPTIONS.map((role) => (
                <ActionButton
                  key={role}
                  label={role}
                  onPress={() => void roleMutation.mutateAsync({ userId: user.id, role })}
                  disabled={roleMutation.isPending || (user.id === currentUser?.id && role === 'member')}
                  variant={user.role === role ? 'primary' : 'secondary'}
                />
              ))}
            </View>
          </SectionCard>
        ))
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  buttonRow: {
    gap: 10,
  },
});
