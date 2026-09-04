import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  DEFAULT_DICTATION_COMMANDS,
  DICTATION_COMMANDS_STORAGE_KEY,
  createDictationCommands,
  deserializeDictationCommands,
} from '../lib/dictation-settings';

export default function SettingsScreen() {
  const router = useRouter();
  const [nextWord, setNextWord] = useState(DEFAULT_DICTATION_COMMANDS.next);
  const [doneWord, setDoneWord] = useState(DEFAULT_DICTATION_COMMANDS.done);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(DICTATION_COMMANDS_STORAGE_KEY)
      .then((stored) => {
        if (!active) {
          return;
        }

        const commands = deserializeDictationCommands(stored);
        setNextWord(commands.next);
        setDoneWord(commands.done);
      })
      .catch(() => {
        if (active) {
          setStatus('Could not load saved dictation settings. Defaults are shown.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const commands = createDictationCommands(nextWord, doneWord);

  const save = async () => {
    if (!commands || saving) {
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      await AsyncStorage.setItem(DICTATION_COMMANDS_STORAGE_KEY, JSON.stringify(commands));
      setNextWord(commands.next);
      setDoneWord(commands.done);
      setStatus('Saved.');
    } catch {
      setStatus('Could not save dictation settings.');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (saving) {
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      await AsyncStorage.setItem(
        DICTATION_COMMANDS_STORAGE_KEY,
        JSON.stringify(DEFAULT_DICTATION_COMMANDS),
      );
      setNextWord(DEFAULT_DICTATION_COMMANDS.next);
      setDoneWord(DEFAULT_DICTATION_COMMANDS.done);
      setStatus('Reset to defaults.');
    } catch {
      setStatus('Could not reset dictation settings.');
    } finally {
      setSaving(false);
    }
  };

  const validationMessage =
    nextWord.trim() && doneWord.trim()
      ? commands
        ? null
        : nextWord.trim().toLowerCase() === doneWord.trim().toLowerCase()
          ? 'The two command words must be different.'
          : 'Each command must be a single word.'
      : 'Both command words are required.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to tasks"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>SETTINGS</Text>
        <Text style={styles.heading}>Dictation commands</Text>
        <Text style={styles.description}>
          Choose the spoken words that create a new task and finish dictation. Commands are
          case-insensitive and must be distinct single words.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>New entry word</Text>
          <TextInput
            accessibilityLabel="New entry dictation word"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(value) => {
              setNextWord(value);
              setStatus(null);
            }}
            placeholder="next"
            placeholderTextColor="#858b85"
            style={styles.input}
            value={nextWord}
          />
          <Text style={styles.help}>Default: “next”</Text>

          <Text style={[styles.label, styles.secondLabel]}>Finish dictation word</Text>
          <TextInput
            accessibilityLabel="Finish dictation word"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(value) => {
              setDoneWord(value);
              setStatus(null);
            }}
            placeholder="done"
            placeholderTextColor="#858b85"
            style={styles.input}
            value={doneWord}
          />
          <Text style={styles.help}>Default: “done”</Text>

          {validationMessage ? <Text style={styles.error}>{validationMessage}</Text> : null}
          {status ? <Text style={styles.status}>{status}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={!commands || saving}
              onPress={() => void save()}
              style={({ pressed }) => [
                styles.saveButton,
                (!commands || saving) && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void reset()}
              style={({ pressed }) => [
                styles.resetButton,
                saving && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.resetText}>Reset defaults</Text>
            </Pressable>
          </View>
        </View>
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
    marginBottom: 16,
  },
  backText: { color: '#405247', fontSize: 14, fontWeight: '800' },
  eyebrow: {
    color: '#657067',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heading: {
    color: '#1f2921',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 8,
  },
  description: {
    color: '#687068',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 600,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#d7d9d2',
    borderWidth: 1,
    borderRadius: 18,
    marginTop: 26,
    padding: 18,
  },
  label: { color: '#263029', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  secondLabel: { marginTop: 20 },
  input: {
    minHeight: 50,
    borderColor: '#cfd3cc',
    borderWidth: 1,
    borderRadius: 13,
    color: '#1e2720',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  help: { color: '#858b85', fontSize: 12, marginTop: 6 },
  error: { color: '#8c4a45', fontSize: 13, lineHeight: 18, marginTop: 18 },
  status: { color: '#405247', fontSize: 13, lineHeight: 18, marginTop: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  saveButton: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#243c2b',
    borderRadius: 13,
    paddingHorizontal: 18,
  },
  saveText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  resetButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderColor: '#b8c0b8',
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 18,
  },
  resetText: { color: '#405247', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.68 },
});
