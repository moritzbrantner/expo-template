import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateTimePickerModal } from '../components/DateTimePickerModal';
import {
  addBottleCare,
  addBreastfeeding,
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
  type FeedingEventEntry,
  type MilkType,
} from '../lib/feeding';
import {
  defaultFeedingPreferences,
  deserializeFeedingPreferences,
  FEEDING_PREFERENCES_STORAGE_KEY,
  feedingModeEnabled,
  type FeedingPreferences,
} from '../lib/preferences';
import { isEarlierLocalDay } from '../lib/recording-time';
import { BABY_FEEDING_STORAGE_KEY } from '../lib/sharing';

type EntryMode = 'breastfeeding' | 'feed' | 'pumping';
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

function entryModesForPreferences(preferences: FeedingPreferences): EntryMode[] {
  const modes: EntryMode[] = [];
  const breastMilkEnabled = feedingModeEnabled(preferences, 'breast-milk');
  const formulaEnabled = feedingModeEnabled(preferences, 'formula');

  if (breastMilkEnabled) modes.push('breastfeeding');
  if (breastMilkEnabled || formulaEnabled) modes.push('feed');
  if (feedingModeEnabled(preferences, 'pumping')) modes.push('pumping');

  return modes;
}

function milkTypesForPreferences(preferences: FeedingPreferences): MilkType[] {
  const milkTypes: MilkType[] = [];
  if (feedingModeEnabled(preferences, 'breast-milk')) milkTypes.push('breast-milk');
  if (feedingModeEnabled(preferences, 'formula')) milkTypes.push('formula');
  return milkTypes;
}

function entryModeLabel(mode: EntryMode) {
  if (mode === 'breastfeeding') return 'Breastfeeding';
  if (mode === 'feed') return 'Bottle';
  return 'Pumping';
}

function latestFeedMeta(entry: FeedingEventEntry) {
  if (entry.kind === 'breastfeeding') return 'Direct breastfeeding';
  return `${milkLabel(entry.milkType)} · ${entry.amountMl} ml`;
}

function entryTitle(entry: FeedingEntry) {
  if (entry.kind === 'breastfeeding') return 'Breastfeeding';
  if (entry.kind === 'feed') return milkLabel(entry.milkType);
  if (entry.kind === 'pumping') return 'Pumping';
  if (entry.kind === 'bottle-clean') return 'Bottles cleaned';
  return 'Bottles sterilized';
}

function entryMeta(entry: FeedingEntry) {
  if (entry.kind === 'breastfeeding') return 'Direct breastfeeding';
  if (entry.kind === 'feed') {
    return `${entry.amountMl} ml${entry.bottleUsed ? ' · bottle used' : ''}`;
  }
  if (entry.kind === 'pumping') return `${entry.amountMl} ml`;
  if (entry.kind === 'bottle-clean') return 'Dirty-bottle count reset';
  return 'Sterilization recorded';
}

function entryDeleteLabel(entry: FeedingEntry) {
  if (entry.kind === 'breastfeeding') return 'breastfeeding';
  if (entry.kind === 'feed') return 'bottle feed';
  if (entry.kind === 'pumping') return 'pumping';
  if (entry.kind === 'bottle-clean') return 'bottle cleaning';
  return 'bottle sterilization';
}

function saveButtonLabel(mode: EntryMode) {
  if (mode === 'breastfeeding') return 'Save breastfeeding';
  if (mode === 'feed') return 'Save bottle feed';
  return 'Save pumping';
}

export default function BabyFeedingApp() {
  const [log, setLog] = useState(emptyFeedingLog);
  const [hydrated, setHydrated] = useState(false);
  const [preferences, setPreferences] = useState<FeedingPreferences | undefined>(undefined);
  const [mode, setMode] = useState<EntryMode>('feed');
  const [milkType, setMilkType] = useState<MilkType>('breast-milk');
  const [amountMl, setAmountMl] = useState(100);
  const [occurredAt, setOccurredAt] = useState(() => roundToFiveMinutes(Date.now()));
  const [bottleUsed, setBottleUsed] = useState(true);
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      AsyncStorage.getItem(BABY_FEEDING_STORAGE_KEY),
      AsyncStorage.getItem(FEEDING_PREFERENCES_STORAGE_KEY),
    ])
      .then(([storedLog, storedPreferences]) => {
        if (!active) return;
        setLog(deserializeFeedingLog(storedLog));
        setPreferences(
          deserializeFeedingPreferences(storedPreferences) ?? defaultFeedingPreferences(),
        );
      })
      .catch(() => {
        if (active) setPreferences(defaultFeedingPreferences());
      })
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
      void AsyncStorage.setItem(BABY_FEEDING_STORAGE_KEY, JSON.stringify(log));
    }, 100);
    return () => clearTimeout(timer);
  }, [hydrated, log]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void AsyncStorage.getItem(FEEDING_PREFERENCES_STORAGE_KEY)
        .then((stored) => {
          if (active) {
            setPreferences(deserializeFeedingPreferences(stored) ?? defaultFeedingPreferences());
          }
        })
        .catch(() => {
          if (active) setPreferences(defaultFeedingPreferences());
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const availableModes = useMemo(
    () => (preferences ? entryModesForPreferences(preferences) : []),
    [preferences],
  );
  const availableMilkTypes = useMemo(
    () => (preferences ? milkTypesForPreferences(preferences) : []),
    [preferences],
  );

  useEffect(() => {
    if (!preferences || availableModes.includes(mode)) return;
    const nextMode = availableModes[0];
    if (!nextMode) return;
    setMode(nextMode);
    setBottleUsed(nextMode === 'feed');
  }, [availableModes, mode, preferences]);

  useEffect(() => {
    if (mode !== 'feed' || availableMilkTypes.includes(milkType)) return;
    const nextMilkType = availableMilkTypes[0];
    if (nextMilkType) setMilkType(nextMilkType);
  }, [availableMilkTypes, milkType, mode]);

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
    setBottleUsed(mode === 'feed');
    setOccurredAt(roundToFiveMinutes(Date.now()));
  };

  const selectMode = (nextMode: EntryMode) => {
    setMode(nextMode);
    setBottleUsed(nextMode === 'feed');
    setError(null);
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

  const setTimeToNow = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    setOccurredAt(now.getTime());
    setError(null);
  };

  const handleSave = () => {
    const id = recordId();

    if (mode === 'breastfeeding') {
      setLog((current) => addBreastfeeding(current, { id, occurredAt }));
      setError(null);
      resetComposer();
      return;
    }

    if (!Number.isSafeInteger(amountMl) || amountMl <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

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

  if (preferences === undefined) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Loading feeding log…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const bottleModeEnabled = availableModes.includes('feed');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.latestFeed}>
          <Text style={styles.latestLabel}>Last feed</Text>
          {mostRecentFeed ? (
            <View style={styles.latestCopy}>
              <Text style={styles.latestValue}>{formatClock(mostRecentFeed.occurredAt)}</Text>
              <Text style={styles.latestMeta}>{latestFeedMeta(mostRecentFeed)}</Text>
            </View>
          ) : (
            <Text style={styles.latestEmpty}>No feed recorded yet.</Text>
          )}
        </View>

        <View style={styles.composer}>
          <Text style={styles.sectionTitle}>Add record</Text>

          {availableModes.length > 1 ? (
            <>
              <Text style={styles.controlLabel}>Record type</Text>
              <View style={styles.choiceRow}>
                {availableModes.map((availableMode) => (
                  <ChoiceButton
                    key={availableMode}
                    label={entryModeLabel(availableMode)}
                    selected={mode === availableMode}
                    onPress={() => selectMode(availableMode)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {mode === 'feed' && availableMilkTypes.length > 1 ? (
            <>
              <Text style={styles.controlLabel}>Milk</Text>
              <View style={styles.choiceRow}>
                {availableMilkTypes.map((availableMilkType) => (
                  <ChoiceButton
                    key={availableMilkType}
                    label={milkLabel(availableMilkType)}
                    selected={milkType === availableMilkType}
                    onPress={() => setMilkType(availableMilkType)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {mode !== 'breastfeeding' ? (
            <>
              <Text style={styles.controlLabel}>Amount</Text>
              <View style={styles.amountDisplay}>
                <Text style={styles.amountValue}>{amountMl}</Text>
                <Text style={styles.unit}>ml</Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepGroup}>
                  <StepButton label="−10 ml" onPress={() => adjustAmount(-10)} />
                  <StepButton label="−5 ml" onPress={() => adjustAmount(-5)} />
                </View>
                <View style={styles.stepGroup}>
                  <StepButton label="+10 ml" onPress={() => adjustAmount(10)} />
                  <StepButton label="+5 ml" onPress={() => adjustAmount(5)} />
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.breastfeedingHint}>
              Direct breastfeeding is recorded without inventing a milk volume.
            </Text>
          )}

          {isEarlierLocalDay(occurredAt, Date.now()) ? (
            <>
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
            </>
          ) : null}

          <Text style={styles.controlLabel}>Time</Text>
          <Pressable
            accessibilityLabel="Select time"
            accessibilityRole="button"
            onPress={() => setPickerMode('time')}
            style={({ pressed }) => [styles.directPicker, pressed && styles.pressed]}>
            <Text style={[styles.directPickerValue, styles.timeDigits]}>{formatClock(occurredAt)}</Text>
            <Text style={styles.directPickerHint}>Tap to choose</Text>
          </Pressable>
          <View style={styles.timeStepRow}>
            <View style={styles.stepGroup}>
              <StepButton
                label="−1 h"
                onPress={() => setOccurredAt((current) => adjustLocalMinutes(current, -60))}
              />
              <StepButton
                label="−5 min"
                onPress={() => setOccurredAt((current) => adjustLocalMinutes(current, -5))}
              />
            </View>
            <Pressable
              accessibilityLabel="Set time to now"
              accessibilityRole="button"
              onPress={setTimeToNow}
              style={({ pressed }) => [styles.nowButton, pressed && styles.pressed]}>
              <Text style={styles.nowButtonText}>Now</Text>
            </Pressable>
            <View style={styles.stepGroup}>
              <StepButton
                label="+1 h"
                onPress={() => setOccurredAt((current) => adjustLocalMinutes(current, 60))}
              />
              <StepButton
                label="+5 min"
                onPress={() => setOccurredAt((current) => adjustLocalMinutes(current, 5))}
              />
            </View>
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
            <Text style={styles.saveButtonText}>{saveButtonLabel(mode)}</Text>
          </Pressable>
        </View>

        {bottleModeEnabled ? (
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
        ) : null}

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
          Records and settings stay on this device. The app records what happened; it does not make
          feeding recommendations or set a medical sterilization schedule.
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
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: '#776d68', fontSize: 14 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  latestFeed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    borderTopColor: '#ded4ce',
    borderTopWidth: 1,
    borderBottomColor: '#ded4ce',
    borderBottomWidth: 1,
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
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceButton: {
    flexGrow: 1,
    flexBasis: 140,
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
  breastfeedingHint: {
    color: '#6e625c',
    fontSize: 13,
    lineHeight: 20,
    borderBottomColor: '#e2d8d2',
    borderBottomWidth: 1,
    paddingVertical: 16,
  },
  stepRow: { flexDirection: 'row', gap: 7, marginTop: 8 },
  timeStepRow: { flexDirection: 'row', alignItems: 'stretch', gap: 7, marginTop: 8 },
  stepGroup: { flex: 1, flexDirection: 'row', gap: 7, minWidth: 0 },
  stepRowThree: { flexDirection: 'row', gap: 7, marginTop: 8 },
  stepButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#d9cec8',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  stepButtonText: { color: '#5f554f', fontSize: 12, fontWeight: '800' },
  nowButton: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#b9aaa3',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  nowButtonText: { color: '#3f5b4d', fontSize: 12, fontWeight: '900' },
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
