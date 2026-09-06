import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createFeedingPreferences,
  defaultFeedingPreferences,
  deserializeFeedingPreferences,
  FEEDING_PREFERENCES_STORAGE_KEY,
  type ButtonPresentation,
  type FeedingMode,
  type FeedingPreferences,
} from '../lib/preferences';

type MethodOption = {
  mode: FeedingMode;
  title: string;
  description: string;
};

const OPTIONS: MethodOption[] = [
  {
    mode: 'breast-milk',
    title: 'Breast milk',
    description: 'Show direct breastfeeding and breast-milk bottle records.',
  },
  {
    mode: 'pumping',
    title: 'Pumping',
    description: 'Show pumping records for expressed milk.',
  },
  {
    mode: 'formula',
    title: 'Formula',
    description: 'Show formula bottle records.',
  },
];

const PRESENTATIONS: Array<{ value: ButtonPresentation; label: string; preview: string }> = [
  { value: 'icons', label: 'Icons', preview: '◉' },
  { value: 'text', label: 'Text', preview: 'Aa' },
  { value: 'icons-text', label: 'Icons + text', preview: '◉ Aa' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<FeedingPreferences>(defaultFeedingPreferences);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(FEEDING_PREFERENCES_STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        setPreferences(deserializeFeedingPreferences(stored) ?? defaultFeedingPreferences());
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const persist = (next: FeedingPreferences) => {
    setPreferences(next);
    setError(null);
    void AsyncStorage.setItem(FEEDING_PREFERENCES_STORAGE_KEY, JSON.stringify(next)).catch(() => {
      setError('Could not save this setting. Try again.');
    });
  };

  const toggleMode = (mode: FeedingMode) => {
    const selected = preferences.modes.includes(mode)
      ? preferences.modes.filter((candidate) => candidate !== mode)
      : [...preferences.modes, mode];
    const next = createFeedingPreferences(selected, preferences.buttonPresentation);

    if (!next) {
      setError('Keep at least one feeding method enabled.');
      return;
    }

    persist(next);
  };

  const setButtonPresentation = (buttonPresentation: ButtonPresentation) => {
    const next = createFeedingPreferences(preferences.modes, buttonPresentation);
    if (next) persist(next);
  };

  const bottlesEnabled =
    preferences.modes.includes('breast-milk') || preferences.modes.includes('formula');
  const pumpingEnabled = preferences.modes.includes('pumping');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityLabel="Back to feeding log"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>BABY FEEDING</Text>
        <Text style={styles.heading}>Settings</Text>

        <Text style={styles.sectionTitle}>Feeding methods</Text>
        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const selected = preferences.modes.includes(option.mode);
            return (
              <Pressable
                key={option.mode}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled: !hydrated }}
                disabled={!hydrated}
                onPress={() => toggleMode(option.mode)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  !hydrated && styles.disabled,
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.check, selected && styles.checkSelected]}>
                  <Text style={[styles.checkText, selected && styles.checkTextSelected]}>
                    {selected ? '✓' : ''}
                  </Text>
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.sectionTitle}>Button style</Text>
        <Text style={styles.sectionDescription}>
          Choose whether recording controls show icons, text, or both.
        </Text>
        <View style={styles.presentationRow}>
          {PRESENTATIONS.map((option) => {
            const selected = preferences.buttonPresentation === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityLabel={`Use ${option.label.toLowerCase()} for buttons`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setButtonPresentation(option.value)}
                style={({ pressed }) => [
                  styles.presentationButton,
                  selected && styles.presentationButtonSelected,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.presentationPreview, selected && styles.presentationTextSelected]}>
                  {option.preview}
                </Text>
                <Text style={[styles.presentationLabel, selected && styles.presentationTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {bottlesEnabled || pumpingEnabled ? (
          <>
            <Text style={styles.sectionTitle}>Care</Text>
            {bottlesEnabled ? (
              <Link href="/bottles" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.rowLink, pressed && styles.pressed]}>
                  <Text style={styles.rowIcon}>🍼</Text>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Bottles</Text>
                    <Text style={styles.rowDescription}>Track dirty, washed, and sterilized bottles.</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </Link>
            ) : null}
            {pumpingEnabled ? (
              <Link href="/pumping-gear" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.rowLink, pressed && styles.pressed]}>
                  <Text style={styles.rowIcon}>💧</Text>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Pumping gear</Text>
                    <Text style={styles.rowDescription}>Track dirty, washed, and sterilized pump kits.</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </Link>
            ) : null}
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Data</Text>
        <Link href="/share" asChild>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.rowLink, pressed && styles.pressed]}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Share feeding log</Text>
              <Text style={styles.rowDescription}>Create or import a point-in-time link.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f2ee' },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
  },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12 },
  backText: { color: '#5f554f', fontSize: 14, fontWeight: '800' },
  eyebrow: { color: '#78685f', fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginTop: 10 },
  heading: {
    color: '#332c29',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 39,
    letterSpacing: -1,
    marginTop: 8,
  },
  sectionTitle: { color: '#3b322e', fontSize: 19, fontWeight: '800', marginTop: 28 },
  sectionDescription: { color: '#847973', fontSize: 12, lineHeight: 18, marginTop: 5 },
  options: { gap: 10, marginTop: 14 },
  option: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderColor: '#d9cec8',
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: '#fffdfb',
    padding: 16,
  },
  optionSelected: { borderColor: '#684f5b', backgroundColor: '#f4ecef' },
  check: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#c8bbb5',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  checkSelected: { borderColor: '#684f5b', backgroundColor: '#684f5b' },
  checkText: { color: '#684f5b', fontSize: 16, fontWeight: '900' },
  checkTextSelected: { color: '#fff' },
  optionCopy: { flex: 1 },
  optionTitle: { color: '#3b322e', fontSize: 16, fontWeight: '800' },
  optionDescription: { color: '#7c716b', fontSize: 13, lineHeight: 19, marginTop: 3 },
  errorText: { color: '#934a45', fontSize: 12, lineHeight: 18, marginTop: 10 },
  presentationRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  presentationButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#d9cec8',
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: '#fffdfb',
    paddingHorizontal: 5,
  },
  presentationButtonSelected: { borderColor: '#684f5b', backgroundColor: '#684f5b' },
  presentationPreview: { color: '#625852', fontSize: 16, fontWeight: '900' },
  presentationLabel: { color: '#625852', fontSize: 10, fontWeight: '800', marginTop: 3, textAlign: 'center' },
  presentationTextSelected: { color: '#fff' },
  rowLink: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopColor: '#ded4ce',
    borderTopWidth: 1,
    borderBottomColor: '#ded4ce',
    borderBottomWidth: 1,
    marginTop: 12,
    paddingVertical: 12,
  },
  rowIcon: { fontSize: 22 },
  rowCopy: { flex: 1 },
  rowTitle: { color: '#3d3430', fontSize: 15, fontWeight: '800' },
  rowDescription: { color: '#847973', fontSize: 12, marginTop: 3 },
  chevron: { color: '#776d68', fontSize: 26, lineHeight: 26 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.66 },
});
