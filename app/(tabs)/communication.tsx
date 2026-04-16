import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { fetchProfilesRequest, type ExampleProfile } from '@/lib/dev-api';

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

async function loadExampleProfiles({
  setIsLoadingProfiles,
  setProfilesError,
  setProfiles,
}: {
  setIsLoadingProfiles: (value: boolean) => void;
  setProfilesError: (value: string | null) => void;
  setProfiles: (value: ExampleProfile[]) => void;
}) {
  try {
    setIsLoadingProfiles(true);
    setProfilesError(null);
    const response = await fetchProfilesRequest();
    setProfiles(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load example profiles.';
    setProfilesError(message);
  } finally {
    setIsLoadingProfiles(false);
  }
}

export default function CommunicationScreen() {
  const borderColor = useThemeColor({}, 'border');
  const mutedTextColor = useThemeColor({}, 'mutedText');
  const [profiles, setProfiles] = useState<ExampleProfile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);

  useEffect(() => {
    void loadExampleProfiles({
      setIsLoadingProfiles,
      setProfilesError,
      setProfiles,
    });
  }, []);

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
            <ThemedText type="subtitle">Example profiles</ThemedText>
            <ThemedText style={{ color: mutedTextColor }}>
              The app calls <ThemedText type="defaultSemiBold">GET /profiles</ThemedText> on the
              local folder-backed dev API so development and testing always have stable REST data.
            </ThemedText>
            {isLoadingProfiles ? (
              <ThemedText style={{ color: mutedTextColor }}>
                Loading example profiles from the dev API...
              </ThemedText>
            ) : profilesError ? (
              <ThemedText style={{ color: mutedTextColor }}>{profilesError}</ThemedText>
            ) : profiles.length === 0 ? (
              <ThemedText style={{ color: mutedTextColor }}>
                No example profiles are available right now.
              </ThemedText>
            ) : (
              profiles.map((profile) => (
                <ThemedView key={profile.username} style={[styles.userRow, { borderColor }]}>
                  <ThemedText type="defaultSemiBold">{profile.name}</ThemedText>
                  <ThemedText style={{ color: mutedTextColor }}>@{profile.username}</ThemedText>
                  <ThemedText style={{ color: mutedTextColor }}>{profile.role}</ThemedText>
                  <ThemedText style={{ color: mutedTextColor }}>{profile.location}</ThemedText>
                  <ThemedText style={{ color: mutedTextColor }}>
                    {profile.bio}
                  </ThemedText>
                </ThemedView>
              ))
            )}
            <Pressable
              style={[styles.reloadButton, { borderColor }]}
              onPress={() =>
                void loadExampleProfiles({
                  setIsLoadingProfiles,
                  setProfilesError,
                  setProfiles,
                })
              }>
              <ThemedText type="defaultSemiBold">Reload profiles</ThemedText>
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
