import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateTimePickerModal } from '../components/DateTimePickerModal';
import {
  addBreastfeeding,
  addFeed,
  addPumping,
  adjustLocalDays,
  adjustLocalMinutes,
  deserializeFeedingLog,
  emptyFeedingLog,
  latestFeed,
  roundToFiveMinutes,
  type FeedingEventEntry,
  type MilkType,
} from '../lib/feeding';
import {
  defaultFeedingPreferences,
  deserializeFeedingPreferences,
  FEEDING_PREFERENCES_STORAGE_KEY,
  feedingModeEnabled,
  type ButtonPresentation,
  type FeedingPreferences,
} from '../lib/preferences';
import { isEarlierLocalDay } from '../lib/recording-time';
import { BABY_FEEDING_STORAGE_KEY } from '../lib/sharing';

type EntryMode = 'breastfeeding' | 'feed' | 'pumping';
type PickerMode = 'date' | 'time';

type ButtonContentProps = {
  icon: string;
  label: string;
  presentation: ButtonPresentation;
  dense?: boolean;
  light?: boolean;
};

type ChoiceButtonProps = ButtonContentProps & {
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
};

type StepButtonProps = ButtonContentProps & {
  onPress: () => void;
};

function ButtonContent({ icon, label, presentation, dense = false, light = false }: ButtonContentProps) {
  const showIcon = presentation !== 'text';
  const showText = presentation !== 'icons';

  return (
    <View style={[styles.buttonContent, dense && styles.buttonContentDense]}>
      {showIcon ? (
        <Text
          style={[
            styles.buttonIcon,
            dense && styles.buttonIconDense,
            light && styles.buttonTextLight,
          ]}>
          {icon}
        </Text>
      ) : null}
      {showText ? (
        <Text
          numberOfLines={1}
          style={[
            styles.buttonLabel,
            dense && styles.buttonLabelDense,
            light && styles.buttonTextLight,
          ]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

function ChoiceButton({
  icon,
  label,
  presentation,
  selected,
  onPress,
  dense = false,
  compact = false,
}: ChoiceButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceButton,
        dense && styles.choiceButtonDense,
        compact && styles.choiceButtonCompact,
        selected && styles.choiceButtonSelected,
        pressed && styles.pressed,
      ]}>
      <ButtonContent
        dense={dense}
        icon={icon}
        label={label}
        light={selected}
        presentation={presentation}
      />
    </Pressable>
  );
}

function StepButton({ icon, label, presentation, onPress, dense = true }: StepButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
      <ButtonContent dense={dense} icon={icon} label={label} presentation={presentation} />
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

function formatDateButton(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
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

function entryModeIcon(mode: EntryMode) {
  if (mode === 'breastfeeding') return '🤱';
  if (mode === 'feed') return '🍼';
  return '💧';
}

function milkIcon(milkType: MilkType) {
  return milkType === 'breast-milk' ? '💧' : '🍼';
}

function latestFeedMeta(entry: FeedingEventEntry) {
  if (entry.kind === 'breastfeeding') return 'Direct breastfeeding';
  return `${milkLabel(entry.milkType)} · ${entry.amountMl} ml`;
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

  const buttonPresentation = preferences.buttonPresentation;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}>
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
              <View style={styles.recordTypeRow}>
                {availableModes.map((availableMode) => (
                  <ChoiceButton
                    key={availableMode}
                    dense
                    icon={entryModeIcon(availableMode)}
                    label={entryModeLabel(availableMode)}
                    presentation={buttonPresentation}
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
                    icon={milkIcon(availableMilkType)}
                    label={milkLabel(availableMilkType)}
                    presentation={buttonPresentation}
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
                  <StepButton
                    icon="−−"
                    label="−10 ml"
                    presentation={buttonPresentation}
                    onPress={() => adjustAmount(-10)}
                  />
                  <StepButton
                    icon="−"
                    label="−5 ml"
                    presentation={buttonPresentation}
                    onPress={() => adjustAmount(-5)}
                  />
                </View>
                <View style={styles.stepGroup}>
                  <StepButton
                    icon="+"
                    label="+5 ml"
                    presentation={buttonPresentation}
                    onPress={() => adjustAmount(5)}
                  />
                  <StepButton
                    icon="++"
                    label="+10 ml"
                    presentation={buttonPresentation}
                    onPress={() => adjustAmount(10)}
                  />
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
                  icon="←"
                  label="−1 day"
                  presentation={buttonPresentation}
                  onPress={() => setOccurredAt((current) => adjustLocalDays(current, -1))}
                />
                <StepButton
                  icon="●"
                  label="Today"
                  presentation={buttonPresentation}
                  onPress={setDateToToday}
                />
                <StepButton
                  icon="→"
                  label="+1 day"
                  presentation={buttonPresentation}
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
                icon="↞"
                label="−1 h"
                presentation={buttonPresentation}
                onPress={() => setOccurredAt((current) => adjustLocalMinutes(current, -60))}
              />
              <StepButton
                icon="‹"
                label="−5 min"
                presentation={buttonPresentation}
                onPress={() => setOccurredAt((current) => adjustLocalMinutes(current, -5))}
              />
            </View>
            <Pressable
              accessibilityLabel="Set time to now"
              accessibilityRole="button"
              onPress={setTimeToNow}
              style={({ pressed }) => [styles.nowButton, pressed && styles.pressed]}>
              <ButtonContent dense icon="◎" label="Now" presentation={buttonPresentation} />
            </Pressable>
            <View style={styles.stepGroup}>
              <StepButton
                icon="↠"
                label="+1 h"
                presentation={buttonPresentation}
                onPress={() => setOccurredAt((current) => adjustLocalMinutes(current, 60))}
              />
              <StepButton
                icon="›"
                label="+5 min"
                presentation={buttonPresentation}
                onPress={() => setOccurredAt((current) => adjustLocalMinutes(current, 5))}
              />
            </View>
          </View>

          {mode === 'feed' ? (
            <>
              <Text style={styles.controlLabel}>Bottle</Text>
              <ChoiceButton
                compact
                icon="🍼"
                label="Bottle used"
                presentation={buttonPresentation}
                selected={bottleUsed}
                onPress={() => setBottleUsed((current) => !current)}
              />
            </>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            accessibilityLabel={saveButtonLabel(mode)}
            accessibilityRole="button"
            onPress={handleSave}
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
            <ButtonContent
              icon="✓"
              label={saveButtonLabel(mode)}
              light
              presentation={buttonPresentation}
            />
          </Pressable>
        </View>
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
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
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
    marginTop: 12,
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
  recordTypeRow: { flexDirection: 'row', gap: 8 },
  choiceRow: { flexDirection: 'row', gap: 8 },
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
    paddingVertical: 10,
  },
  choiceButtonDense: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 56,
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  choiceButtonCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  choiceButtonSelected: { backgroundColor: '#684f5b', borderColor: '#684f5b' },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 0,
  },
  buttonContentDense: { flexDirection: 'column', gap: 1 },
  buttonIcon: { color: '#625852', fontSize: 16, fontWeight: '900', lineHeight: 19 },
  buttonIconDense: { fontSize: 17, lineHeight: 19 },
  buttonLabel: { color: '#625852', fontSize: 12, fontWeight: '800', flexShrink: 1 },
  buttonLabelDense: { fontSize: 10, lineHeight: 13, textAlign: 'center' },
  buttonTextLight: { color: '#fffaf7' },
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
    paddingHorizontal: 6,
  },
  nowButton: {
    minWidth: 58,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#b9aaa3',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 6,
  },
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
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3f5b4d',
    borderRadius: 15,
    marginTop: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pressed: { opacity: 0.66 },
});