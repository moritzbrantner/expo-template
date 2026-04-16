import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

const sections = [
  {
    title: 'Auth flow',
    description:
      'The template ships with sign-up and sign-in routes backed by the local auth-api and Mailpit.',
  },
  {
    title: 'Communication directory',
    description:
      'The Communication tab fetches signed-up users from GET /users and links each row to a live profile route.',
  },
  {
    title: 'Theme persistence',
    description:
      'Settings writes the selected light or dark mode to storage so the choice survives reloads.',
  },
  {
    title: 'Optional dev fixture',
    description:
      'A separate seeded dev-api remains available as a Dockerized REST example, but it is not the app user directory.',
  },
];

export default function ExploreScreen() {
  const borderColor = useThemeColor({}, 'border');
  const mutedTextColor = useThemeColor({}, 'mutedText');

  return (
    <ThemedView style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="title">Explore</ThemedText>
            <ThemedText style={{ color: mutedTextColor }}>
              This template is centered on Expo Router, a local auth stack, live user profiles, and
              saved theme preference instead of a catalog of placeholder screens.
            </ThemedText>
          </ThemedView>

          {sections.map((section) => (
            <ThemedView
              key={section.title}
              style={[styles.card, { borderColor }]}
              lightColor={Colors.light.surface}
              darkColor={Colors.dark.surface}>
              <ThemedText type="subtitle">{section.title}</ThemedText>
              <ThemedText style={{ color: mutedTextColor }}>{section.description}</ThemedText>
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
});
