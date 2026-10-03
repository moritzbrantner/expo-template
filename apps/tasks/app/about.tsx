import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to tasks"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>ABOUT</Text>
        <Text style={styles.heading}>A small place for the next thing.</Text>
        <Text style={styles.intro}>
          Tasks is intentionally simple: capture what needs doing, finish it, and move on.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Local by default</Text>
        <Text style={styles.body}>
          Your task list is stored on this device. There is no account required to keep a list.
        </Text>

        <Text style={styles.sectionTitle}>Dictation</Text>
        <Text style={styles.body}>
          Speech recognition is provided by your browser or keyboard. The app uses the resulting
          text to separate tasks and to recognize the words you choose for next and done.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingRight: 16,
    marginBottom: 20,
  },
  backText: { color: '#526057', fontSize: 14, fontWeight: '700' },
  eyebrow: {
    color: '#7a817b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  heading: {
    color: '#273029',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 34,
    marginTop: 8,
    maxWidth: 520,
  },
  intro: {
    color: '#6f766f',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 560,
  },
  divider: {
    height: 1,
    backgroundColor: '#d9dbd5',
    marginVertical: 28,
  },
  sectionTitle: {
    color: '#3d4840',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  body: {
    color: '#757b76',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 7,
    marginBottom: 24,
    maxWidth: 580,
  },
  pressed: { opacity: 0.62 },
});
