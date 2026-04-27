import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActionButton, ScreenScroll, SectionCard, StatPill } from '@/components/social/ui';
import { ThemedText } from '@/components/themed-text';

export default function PublicIndexScreen() {
  const router = useRouter();

  return (
    <ScreenScroll
      title="Social app-shell baseline"
      description="A reusable Expo scaffold surface with public profiles, protected app tabs, follow activity, and a real auth lifecycle.">
      <SectionCard>
        <ThemedText type="subtitle">Scaffold contract</ThemedText>
        <ThemedText>
          Public profiles stay readable to guests. Everything else runs behind a server-backed session
          restored from `GET /auth/session`.
        </ThemedText>
        <View style={styles.actions}>
          <ActionButton label="Sign in" onPress={() => router.push('/auth/sign-in')} />
          <ActionButton
            label="Create account"
            onPress={() => router.push('/auth/sign-up')}
            variant="secondary"
          />
        </View>
      </SectionCard>

      <SectionCard>
        <ThemedText type="subtitle">What ships here</ThemedText>
        <View style={styles.statRow}>
          <StatPill label="Profiles" value="username routes" />
          <StatPill label="Social" value="follow graph" />
          <StatPill label="Lifecycle" value="verify and reset" />
        </View>
      </SectionCard>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
