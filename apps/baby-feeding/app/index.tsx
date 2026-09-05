import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addFeed,
  addPumping,
  deserializeFeedingLog,
  emptyFeedingLog,
  formatDateInput,
  formatTimeInput,
  latestFeed,
  parseLocalDateTime,
  removeEntry,
  type FeedingEntry,
  type MilkType,
} from '../lib/feeding';

const STORAGE_KEY = '@expo-template/baby-feeding/log-v1';

type EntryMode = 'feed' | 'pumping';

type ChoiceButtonProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function ChoiceButton({ label, selected, onPress }: ChoiceButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceButton,
        selected && styles.choiceButtonSelected,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.choiceButtonText, selected && styles.choiceButtonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function recordId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatClock(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(timestamp),
  );
}

function formatDay(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function milkLabel(milkType: MilkType) {
  return milkType === 'breast-milk' ? 'Breast milk' : 'Formula';
}

export default function BabyFeedingApp() {
  const [log, setLog] = useState(emptyFeedingLog);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<EntryMode>('feed');
  const [milkType, setMilkType] = useState<MilkType>('breast-milk');
  const [amountText, setAmountText] = useState('');
  const [dateText, setDateText] = useState(() => formatDateInput(Date.now()));
  const [timeText, setTimeText] = useState(() => formatTimeInput(Date.now()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active) setLog(deserializeFeedingLog(stored));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    }, 100);
    return () => clearTimeout(timer);
  }, [hydrated, log]);

  const mostRecentFeed = useMemo(() => latestFeed(log), [log]);
  const groupedEntries = useMemo(() => {
    const groups: Array<{ key: string; label: string; entries: FeedingEntry[] }> = [];
    const newestFirst = [...log.entries].sort(
      (left, right) => right.occurredAt - left.occurredAt || right.id.localeCompare(left.id),
    );

    for (const entry of newestFirst) {
      const key = formatDateInput(entry.occurredAt);
      const current = groups.at(-1);
      if (current?.key === key) {
        current.entries.push(entry);
      } else {
        groups.push({ key, label: formatDay(entry.occurredAt), entries: [entry] });
      }
    }

    return groups;
  }, [log.entries]);

  const resetTimestampInputs = () => {
    const now = Date.now();
    setDateText(formatDateInput(now));
    setTimeText(formatTimeInput(now));
  };

  const handleSave = () => {
    const trimmedAmount = amountText.trim();
    if (!/^\d+$/.test(trimmedAmount)) {
      setError('Enter the amount as a whole number of millilitres.');
      return;
    }

    const amountMl = Number(trimmedAmount);
    if (!Number.isSafeInteger(amountMl) || amountMl <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    const occurredAt = parseLocalDateTime(dateText, timeText);
    if (occurredAt === null) {
      setError('Use a valid date (YYYY-MM-DD) and time (HH:MM).');
      return;
    }

    const id = recordId();
    setLog((current) =>
      mode === 'feed'
        ? addFeed(current, { id, milkType, amountMl, occurredAt })
        : addPumping(current, { id, amountMl, occurredAt }),
    );
    setAmountText('');
    setError(null);
    resetTimestampInputs();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>BABY FEEDING</Text>
        <Text style={styles.heading}>Bottle feeds and pumping, written down properly.</Text>
        <Text style={styles.subheading}>
          Record the time and millilitres, and distinguish breast milk from formula.
        </Text>

        <View style={styles.latestFeed}>
          <Text style={styles.latestLabel}>Last feed</Text>
          {mostRecentFeed ? (
            <View style={styles.latestCopy}>
              <Text style={styles.latestValue}>{formatClock(mostRecentFeed.occurredAt)}</Text>
              <Text style={styles.latestMeta}>
                {milkLabel(mostRecentFeed.milkType)} · {mostRecentFeed.amountMl} ml
              </Text>
            </View>
          ) : (
            <Text style={styles.latestEmpty}>No feed recorded yet.</Text>
          )}
        </View>

        <View style={styles.composer}>
          <Text style={styles.sectionTitle}>Add record</Text>

          <Text style={styles.controlLabel}>Record type</Text>
          <View style={styles.choiceRow}>
            <ChoiceButton label="Feed" selected={mode === 'feed'} onPress={() => setMode('feed')} />
            <ChoiceButton
              label="Pumping"
              selected={mode === 'pumping'}
              onPress={() => setMode('pumping')}
            />
          </View>

          {mode === 'feed' ? (
            <>
              <Text style={styles.controlLabel}>Milk</Text>
              <View style={styles.choiceRow}>
                <ChoiceButton
                  label="Breast milk"
                  selected={milkType === 'breast-milk'}
                  onPress={() => setMilkType('breast-milk')}
                />
                <ChoiceButton
                  label="Formula"
                  selected={milkType === 'formula'}
                  onPress={() => setMilkType('formula')}
                />
              </View>
            </>
          ) : null}

          <Text style={styles.controlLabel}>Amount</Text>
          <View style={styles.amountRow}>
            <TextInput
              accessibilityLabel="Amount in millilitres"
              keyboardType="number-pad"
              onChangeText={setAmountText}
              placeholder="100"
              placeholderTextColor="#a29a94"
              style={[styles.textInput, styles.amountInput]}
              value={amountText}
            />
            <Text style={styles.unit}>ml</Text>
          </View>

          <View style={styles.dateTimeRow}>
            <View style={styles.dateField}>
              <Text style={styles.controlLabel}>Date</Text>
              <TextInput
                accessibilityLabel="Date"
                autoCapitalize="none"
                onChangeText={setDateText}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#a29a94"
                style={styles.textInput}
                value={dateText}
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.controlLabel}>Time</Text>
              <TextInput
                accessibilityLabel="Time"
                autoCapitalize="none"
                onChangeText={setTimeText}
                placeholder="HH:MM"
                placeholderTextColor="#a29a94"
                style={styles.textInput}
                value={timeText}
              />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            onPress={handleSave}
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
            <Text style={styles.saveButtonText}>{mode === 'feed' ? 'Save feed' : 'Save pumping'}</Text>
          </Pressable>
        </View>

        <Text style={styles.timelineTitle}>Log</Text>
        {groupedEntries.length === 0 ? (
          <Text style={styles.emptyText}>Your feeding log will appear here.</Text>
        ) : (
          groupedEntries.map((group) => (
            <View key={group.key} style={styles.dayGroup}>
              <Text style={styles.dayHeading}>{group.label}</Text>
              {group.entries.map((entry) => (
                <View key={entry.id} style={styles.entryRow}>
                  <Text style={styles.entryTime}>{formatClock(entry.occurredAt)}</Text>
                  <View style={styles.entryCopy}>
                    <Text style={styles.entryTitle}>
                      {entry.kind === 'feed' ? milkLabel(entry.milkType) : 'Pumping'}
                    </Text>
                    <Text style={styles.entryMeta}>{entry.amountMl} ml</Text>
                  </View>
                  <Pressable
                    accessibilityLabel={`Delete ${entry.kind === 'feed' ? 'feed' : 'pumping'} record`}
                    onPress={() => setLog((current) => removeEntry(current, entry.id))}
                    style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}

        <Text style={styles.footer}>
          Records stay on this device. This is a log, not a feeding recommendation or medical decision tool.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f2ee' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  eyebrow: { color: '#78685f', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#332c29', fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1, marginTop: 8 },
  subheading: { color: '#776d68', fontSize: 14, lineHeight: 21, marginTop: 10 },
  latestFeed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderTopColor: '#ded4ce', borderTopWidth: 1, borderBottomColor: '#ded4ce', borderBottomWidth: 1, marginTop: 24, paddingVertical: 16 },
  latestLabel: { color: '#77665e', fontSize: 12, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  latestCopy: { alignItems: 'flex-end' },
  latestValue: { color: '#342c29', fontSize: 23, fontWeight: '800', fontVariant: ['tabular-nums'] },
  latestMeta: { color: '#786e69', fontSize: 12, marginTop: 2 },
  latestEmpty: { color: '#918680', fontSize: 13 },
  composer: { backgroundColor: '#fffdfb', borderColor: '#e2d8d2', borderWidth: 1, borderRadius: 22, marginTop: 22, padding: 18 },
  sectionTitle: { color: '#3b322e', fontSize: 19, fontWeight: '800' },
  controlLabel: { color: '#786a63', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginTop: 18, marginBottom: 7, textTransform: 'uppercase' },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choiceButton: { flex: 1, alignItems: 'center', borderColor: '#d9cec8', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12 },
  choiceButtonSelected: { backgroundColor: '#684f5b', borderColor: '#684f5b' },
  choiceButtonText: { color: '#625852', fontSize: 13, fontWeight: '700' },
  choiceButtonTextSelected: { color: '#fffaf7' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput: { flex: 1 },
  unit: { color: '#6e625c', fontSize: 15, fontWeight: '800' },
  textInput: { minHeight: 46, backgroundColor: '#fff', borderColor: '#d9cec8', borderWidth: 1, borderRadius: 13, color: '#332c29', fontSize: 15, paddingHorizontal: 13, paddingVertical: 10 },
  dateTimeRow: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1.35 },
  timeField: { flex: 0.85 },
  errorText: { color: '#934a45', fontSize: 12, lineHeight: 18, marginTop: 12 },
  saveButton: { alignItems: 'center', backgroundColor: '#3f5b4d', borderRadius: 15, marginTop: 18, paddingVertical: 15 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  timelineTitle: { color: '#3b322e', fontSize: 19, fontWeight: '800', marginTop: 28 },
  dayGroup: { marginTop: 17 },
  dayHeading: { color: '#8a7d76', fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomColor: '#ded4ce', borderBottomWidth: 1, paddingVertical: 13 },
  entryTime: { width: 64, color: '#3d3430', fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  entryCopy: { flex: 1 },
  entryTitle: { color: '#3d3430', fontSize: 14, fontWeight: '700' },
  entryMeta: { color: '#847973', fontSize: 12, marginTop: 2 },
  deleteButton: { paddingVertical: 7, paddingLeft: 8 },
  deleteText: { color: '#96534e', fontSize: 11, fontWeight: '700' },
  emptyText: { color: '#8e837d', borderBottomColor: '#ded4ce', borderBottomWidth: 1, paddingVertical: 24 },
  footer: { color: '#928780', fontSize: 12, lineHeight: 18, marginTop: 28 },
  pressed: { opacity: 0.66 },
});
