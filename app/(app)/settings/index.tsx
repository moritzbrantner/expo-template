import { useRouter, type Href } from 'expo-router';

import { UserPreferencesCard } from '@/components/settings/user-preferences-card';
import { ActionButton, ScreenScroll, SectionCard } from '@/components/social/ui';
import { ThemeModeToggle } from '@/components/theme-mode-toggle';
import { ThemedText } from '@/components/themed-text';
import { useUserPreferences } from '@/providers/user-preferences-provider';
import { useAuth } from '@/providers/auth-provider';

export default function SettingsScreen() {
  const router = useRouter();
  const { hasPermission, signOut } = useAuth();
  const preferences = useUserPreferences();

  return (
    <ScreenScroll
      title="Settings"
      description="Secondary navigation for account management, theme preferences, and admin-only role tools.">
      <UserPreferencesCard preferences={preferences} />

      <SectionCard>
        <ThemedText type="subtitle">Account</ThemedText>
        <ThemedText>Update your public profile fields and avatar.</ThemedText>
        <ActionButton label="Open account settings" onPress={() => router.push('/settings/account' as Href)} />
      </SectionCard>

      {hasPermission('role.manage:any') ? (
        <SectionCard>
          <ThemedText type="subtitle">Admin</ThemedText>
          <ThemedText>Review users and manage roles.</ThemedText>
          <ActionButton label="Open admin settings" onPress={() => router.push('/settings/admin' as Href)} />
        </SectionCard>
      ) : null}

      <SectionCard>
        <ThemedText type="subtitle">Theme</ThemedText>
        <ThemeModeToggle />
      </SectionCard>

      <SectionCard>
        <ThemedText type="subtitle">Session</ThemedText>
        <ActionButton label="Sign out" onPress={() => void signOut()} variant="danger" testID="signout-button" />
      </SectionCard>
    </ScreenScroll>
  );
}
