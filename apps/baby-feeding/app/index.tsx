import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateTimePickerModal } from '../components/DateTimePickerModal';
import {
  addBottleCare,
  addFeed,
  addPumping,
  adjustLocalDays,
  adjustLocalMinutes,
  deserializeFeedingLog,
  dirtyBottleCount,
  emptyFeedingLog,
  formatDateInput,
  latestBottleCare,
  latestFeed,
  removeEntry,
  roundToFiveMinutes,
  type BottleCareKind,
  type FeedingEntry,
  type MilkType,
} from '../lib/feeding';

const STORAGE_KEY = '@expo-template/baby-feeding/log-v1';

type EntryMode = 'feed' | 'pumping';
type PickerMode = 'date' | 'time';

type ChoiceButtonProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

type StepButtonProps = {
  label: string;
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

function StepButton({ label, onPress }: StepButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
      <Text style={styles.stepButtonText}>{label}</Text>
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

function formatDateButton(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(timestamp));
}

function formatCareTimestamp(timestamp: number | null) {
  if (timestamp === null) return 'Not recorded';
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function milkLabel(milkType: MilkType) {
  return milkType === 'breast-milk' ? 'Breast milk' : 'Formula';
}

function entryTitle(entry: FeedingEntry) {
  if (entry.kind === 'feed') return milkLabel(entry.milkType);
  if (entry.kind === 'pumping') return 'Pumping';
  if (entry.kind === 'bottle-clean') return 'Bottles cleaned';
  return 'Bottles sterilized';
}

function entryMeta(entry: FeedingEntry) {
  if (entry.kind === 'feed') {
    return `${entry.amountMl} ml${entry.bottleUsed ? ' · bottle used' : ''}`;
  }
  if (entry.kind === 'pumping') return `${entry.amountMl} ml`;
  if (entry.kind === 'bottle-clean') return 'Dirty-bottle count reset';
  return 'Sterilization recorded';
}

function entryDeleteLabel(entry: FeedingEntry) {
  if (entry.kind === 'feed') return 'feed';
  if (entry.kind === 'pumping') return 'pumping';
  if (entry.kind === 'bottle-clean') return 'bottle cleaning';
  return 'bottle sterilization';
}

export default function BabyFeedingApp() {
  const [log, setLog] = useState(emptyFeedingLog);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<EntryMode>('feed');
  const [milkType, setMilkType] = useState<MilkType>('breast-milk');
  const [amountMl, setAmountMl] = useState(100);
  const [occurredAt, setOccurredAt] = useState(() => roundToFiveMinutes(Date.now()));
  const [bottleUsed, setBottleUsed] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
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
  const dirtyBottles = useMemo(() => dirtyBottleCount(log), [log]);
  const lastCleaned = useMemo(() => latestBottleCare(log, 'bottle-clean'), [log]);
  const lastSterilized = useMemo(() => latestBottleCare(log, 'bottle-sterilize'), [log]);
  const sterilizedSinceLastClean =
    lastCleaned === null
      ? null
      : lastSterilized !== null && lastSterilized.occurredAt >= lastCleaned.occurredAt;

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

  const resetComposer = () => {
    setAmountMl(100);
    setBottleUsed(false);
    setOccurredAt(roundToFiveMinutes(Date.now()));
  };

  const adjustAmount = (delta: number) => {
    setAmountMl((current) => Math.max(0, Math.min(2000, current + delta)));
    setError(null);
  };

  const setDateToToday = () => {
    setOccurredAt((current) => {
      const next = new Date(current);
      const today = new Date();
      next.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
      return next.getTime();
    });
  };

  const handleSave = () => {
    if (!Number.isSafeInteger(amountMl) || amountMl <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    const id = recordId();
    setLog((current) =>
      mode === 'feed'
        ? addFeed(current, { id, milkType, amountMl, occurredAt, bottleUsed })
        : addPumping(current, { id, amountMl, occurredAt }),
    );
    setError(null);
    resetComposer();
  };

  const handleBottleCare = (kind: BottleCareKind) => {
    setLog((current) =>
      addBottleCare(current, {
        id: recordId(),
        kind,
        occurredAt: Date.now(),
      }),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>BABY FEEDING</Text>
        <Text style={styles.heading}>Bottle feeds and pumping, written down properly.</Text>
        <Text style={styles.subheading}>
          Tap the common adjustments instead of typing. Date and time open a dedicated picker only when
          selected directly.
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
          <View style={styles.amountDisplay}>
            <Text style={styles.amountValue}>{amountMl}</Text>
            <Text style={styles.unit}>ml</Text>
          </View>
          <View style={styles.stepRow}>
            <StepButton label="−10 ml" onPress={() => adjustAmount(-10)} />
            <StepButton label="−5 ml" onPress={() => adjustAmount(-5)} />
            <StepButton label="+5 ml" onPress={() => adjustAmount(5)} />
            <StepButton label="+10 ml" onPress={() => adjustAmount(10)} />
          </View>

          <Text style={styles.controlLabel}>Date</Text>
          <Pressable
            accessibilityLabel="Select date"
            accessibilityRole="button"
            onPress={() => setPickerMode('date')}
            style={({ pressed }) => [styles.directPicker, pressed && styles.pressed]}>
            <Text style={styles.directPickerValue}>{formatDateButton(occurredAt)}</Text>
            <Text style={styles.directPickerHint}>Tap to choose</Text>
          </Pressable>
          <View style={styles.stepRowThree}>
            <StepButton
              label="−1 day"
              onPress={() => setOccurredAt((current) => adjustLocalDays(current, -1))}
            />
            <StepButton label="Today" onPress={setDateToToday} />
            <StepButton
              label="+1 day"
              onPress={() => setOccurredAt((current) => adjustLocalDays(current, 1))}
            />
          </View>

          <Text style={styles.controlLabel}>Time</Text>
          <Pressable
            accessibilityLabel="Select time"
            accessibilityRole="button"
            onPress={() => setPickerMode('time')}
            style={({ pressed }) => [styles.directPicker, pressed && styles.pressed]}>
            <Text style={[styles.directPickerValue, styles.timeDigits]}>{formatClock(occurredAt)}</Text>
            <Text style={styles.directPickerHint}>Tap to choose</Text>
          </Pressable>
          <View style={styles.stepRow}>
            <StepButton
              label="−1 h"
              onPress={() => setOccurredAt((current) => adjustLocalMinutes(current, -60))}
            />
            <StepButton
              label="−5 min"
              onPress={() => setOccurredAt((current) => adjustLocalMinutes(current, -5))}
            />
            <StepButton
              label="+5 min"
              onPress={() => setOccurredAt((current) => adjustLocalMinutes(current, 5))}
            />
            <StepButton
              label="+1 h"
              onPress={() => setOccurredAt((current) => adjustLocalMinutes(current, 60))}
            />
          </View>

          {mode === 'feed' ? (
            <>
              <Text style={styles.controlLabel}>Bottle</Text>
              <ChoiceButton
                label="Bottle used"
                selected={bottleUsed}
                onPress={() => setBottleUsed((current) => !current)}
              />
            </>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            onPress={handleSave}
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
            <Text style={styles.saveButtonText}>{mode === 'feed' ? 'Save feed' : 'Save pumping'}</Text>
          </Pressable>
        </View>

        <View style={styles.bottleCare}>
          <Text style={styles.sectionTitle}>Bottle care</Text>
          <View style={styles.bottleStatusRow}>
            <View style={styles.bottleStatusCopy}>
              <Text style={styles.bottleStatusLabel}>Dirty bottles</Text>
              <Text style={styles.bottleStatusHint}>
                {dirtyBottles > 0
                  ? 'These recorded bottle uses have not been marked cleaned yet.'
                  : 'No dirty bottles are currently recorded.'}
              </Text>
            </View>
            <Text style={styles.bottleCount}>{dirtyBottles}</Text>
          </View>

          <View style={styles.careActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: dirtyBottles === 0 }}
              disabled={dirtyBottles === 0}
              onPress={() => handleBottleCare('bottle-clean')}
              style={({ pressed }) => [
                styles.careButton,
                dirtyBottles === 0 && styles.careButtonDisabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.careButtonText}>Mark all cleaned</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleBottleCare('bottle-sterilize')}
              style={({ pressed }) => [styles.careButton, pressed && styles.pressed]}>
              <Text style={styles.careButtonText}>Mark sterilized</Text>
            </Pressable>
          </View>

          <View style={styles.careHistory}>
            <Text style={styles.careHistoryText}>
              Last cleaned: {formatCareTimestamp(lastCleaned?.occurredAt ?? null)}
            </Text>
            <Text style={styles.careHistoryText}>
              Last sterilized: {formatCareTimestamp(lastSterilized?.occurredAt ?? null)}
            </Text>
            <Text style={styles.careStateText}>
              {sterilizedSinceLastClean === null
                ? 'No cleaning cycle recorded yet.'
                : sterilizedSinceLastClean
                  ? 'Sterilization has been recorded since the last cleaning.'
                  : 'Sterilization has not been recorded since the last cleaning.'}
            </Text>
          </View>
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
                    <Text style={styles.entryTitle}>{entryTitle(entry)}</Text>
                    <Text style={styles.entryMeta}>{entryMeta(entry)}</Text>
                  </View>
                  <Pressable
                    accessibilityLabel={`Delete ${entryDeleteLabel(entry)} record`}
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
          Records stay on this device. Bottle care records what has been cleaned or sterilized; it does
          not set a medical sterilization schedule or make feeding recommendations.
        </Text>
      </ScrollView>

      <DateTimePickerModal
        mode={pickerMode ?? 'time'}
        onChange={setOccurredAt}
        onClose={() => setPickerMode(null)}
        value={occurredAt}
        visible={pickerMode !== null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f2ee' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingBottom: 48 },
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
  latestFeed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    borderTopColor: '#ded4ce',
    borderTopWidth: 1,
    borderBottomColor: '#ded4ce',
    borderBottomWidth: 1,
    marginTop: 24,
    paddingVertical: 16,
  },
  latestLabel: {
    color: '#77665e',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  latestCopy: { alignItems: 'flex-end' },
  latestValue: { color: '#342c29', fontSize: 23, fontWeight: '800', fontVariant: ['tabular-nums'] },
  latestMeta: { color: '#786e69', fontSize: 12, marginTop: 2 },
  latestEmpty: { color: '#918680', fontSize: 13 },
  composer: {
    backgroundColor: '#fffdfb',
    borderColor: '#e2d8d2',
    borderWidth: 1,
    borderRadius: 22,
    marginTop: 22,
    padding: 18,
  },
  sectionTitle: { color: '#3b322e', fontSize: 19, fontWeight: '800' },
  controlLabel: {
    color: '#786a63',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 7,
    textTransform: 'uppercase',
  },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choiceButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#d9cec8',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  choiceButtonSelected: { backgroundColor: '#684f5b', borderColor: '#684f5b' },
  choiceButtonText: { color: '#625852', fontSize: 13, fontWeight: '700' },
  choiceButtonTextSelected: { color: '#fffaf7' },
  amountDisplay: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#fff',
    borderColor: '#d9cec8',
    borderWidth: 1,
    borderRadius: 14,
    padding: 11,
  },
  amountValue: { color: '#332c29', fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { color: '#6e625c', fontSize: 14, fontWeight: '800' },
  stepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  stepRowThree: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  stepButton: {
    flexGrow: 1,
    flexBasis: 108,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#d9cec8',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  stepButtonText: { color: '#5f554f', fontSize: 12, fontWeight: '800' },
  directPicker: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#fff',
    borderColor: '#d9cec8',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  directPickerValue: { flex: 1, color: '#332c29', fontSize: 16, fontWeight: '800' },
  directPickerHint: { color: '#958984', fontSize: 11, fontWeight: '700' },
  timeDigits: { fontVariant: ['tabular-nums'], fontSize: 20 },
  errorText: { color: '#934a45', fontSize: 12, lineHeight: 18, marginTop: 12 },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#3f5b4d',
    borderRadius: 15,
    marginTop: 18,
    paddingVertical: 15,
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  bottleCare: {
    borderTopColor: '#ded4ce',
    borderTopWidth: 1,
    borderBottomColor: '#ded4ce',
    borderBottomWidth: 1,
    marginTop: 26,
    paddingVertical: 20,
  },
  bottleStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 14,
  },
  bottleStatusCopy: { flex: 1 },
  bottleStatusLabel: { color: '#4c413c', fontSize: 14, fontWeight: '800' },
  bottleStatusHint: { color: '#847973', fontSize: 12, lineHeight: 18, marginTop: 3 },
  bottleCount: { color: '#3d3430', fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  careActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 },
  careButton: {
    flexGrow: 1,
    flexBasis: 180,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#bcb0aa',
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
  },
  careButtonDisabled: { opacity: 0.4 },
  careButtonText: { color: '#544943', fontSize: 13, fontWeight: '800' },
  careHistory: { gap: 4, marginTop: 14 },
  careHistoryText: { color: '#776d68', fontSize: 12, lineHeight: 18 },
  careStateText: { color: '#5e524d', fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 3 },
  timelineTitle: { color: '#3b322e', fontSize: 19, fontWeight: '800', marginTop: 28 },
  dayGroup: { marginTop: 17 },
  dayHeading: {
    color: '#8a7d76',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomColor: '#ded4ce',
    borderBottomWidth: 1,
    paddingVertical: 13,
  },
  entryTime: {
    width: 64,
    color: '#3d3430',
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  entryCopy: { flex: 1 },
  entryTitle: { color: '#3d3430', fontSize: 14, fontWeight: '700' },
  entryMeta: { color: '#847973', fontSize: 12, marginTop: 2 },
  deleteButton: { paddingVertical: 7, paddingLeft: 8 },
  deleteText: { color: '#96534e', fontSize: 11, fontWeight: '700' },
  emptyText: {
    color: '#8e837d',
    borderBottomColor: '#ded4ce',
    borderBottomWidth: 1,
    paddingVertical: 24,
  },
  footer: { color: '#928780', fontSize: 12, lineHeight: 18, marginTop: 28 },
  pressed: { opacity: 0.66 },
});
