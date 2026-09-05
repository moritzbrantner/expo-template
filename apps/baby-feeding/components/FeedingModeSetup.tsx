import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createFeedingPreferences,
  type FeedingMode,
  type FeedingPreferences,
} from '../lib/preferences';

type FeedingModeSetupProps = {
  initialPreferences?: FeedingPreferences | null;
  onCancel?: () => void;
  onSave: (preferences: FeedingPreferences) => void | Promise<void>;
};

type ModeOption = {
  mode: FeedingMode;
  title: string;
  description: string;
};

const OPTIONS: ModeOption[] = [
  {
    mode: 'breastfeeding',
    title: 'Breastfeeding',
    description: 'Direct breastfeeding at the breast.',
  },
  {
    mode: 'bottle',
    title: 'Bottle feeding',
    description: 'Bottle feeds with breast milk or formula.',
  },
  {
    mode: 'pumping',
    title: 'Pumping',
    description: 'Expressing milk with a pump.',
  },
];

export function FeedingModeSetup({ initialPreferences, onCancel, onSave }: FeedingModeSetupProps) {
  const [selectedModes, setSelectedModes] = useState<FeedingMode[]>(
    () => initialPreferences?.modes ?? [],
  );
  const [saving, setSaving] = useState(false);

  const preferences = useMemo(
    () => createFeedingPreferences(selectedModes),
    [selectedModes],
  );

  const toggleMode = (mode: FeedingMode) => {
    setSelectedModes((current) =>
      current.includes(mode) ? current.filter((candidate) => candidate !== mode) : [...current, mode],
    );
  };

  const save = async () => {
    if (!preferences || saving) return;
    setSaving(true);
    try {
      await onSave(preferences);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>BABY FEEDING SETUP</Text>
        <Text style={styles.heading}>How are you feeding right now?</Text>
        <Text style={styles.subheading}>
          Choose all that apply. The app will show only the workflows you use, and you can change this later.
        </Text>

        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const selected = selectedModes.includes(option.mode);
            return (
              <Pressable
                key={option.mode}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleMode(option.mode)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
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

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !preferences || saving }}
          disabled={!preferences || saving}
          onPress={save}
          style={({ pressed }) => [
            styles.primaryButton,
            (!preferences || saving) && styles.disabled,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Use these modes'}</Text>
        </Pressable>

        {onCancel ? (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onCancel}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        ) : null}

        <Text style={styles.footer}>
          This setup only controls which recording tools are visible. It does not make a feeding recommendation.
        </Text>
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
    paddingTop: 34,
    paddingBottom: 48,
  },
  eyebrow: { color: '#78685f', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: {
    color: '#332c29',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 39,
    letterSpacing: -1,
    marginTop: 8,
  },
  subheading: { color: '#776d68', fontSize: 14, lineHeight: 21, marginTop: 10 },
  options: { gap: 10, marginTop: 26 },
  option: {
    minHeight: 82,
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
  primaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3f5b4d',
    borderRadius: 15,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#c8bbb5',
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 10,
  },
  secondaryButtonText: { color: '#5f554f', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.42 },
  footer: { color: '#928780', fontSize: 12, lineHeight: 18, marginTop: 24 },
  pressed: { opacity: 0.66 },
});
