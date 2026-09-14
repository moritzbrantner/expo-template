import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createStopwatch,
  createTimer,
  deserializeClockState,
  pauseStopwatch,
  pauseTimer,
  resetStopwatch,
  resetTimer,
  startStopwatch,
  startTimer,
  stopwatchElapsedMs,
  timerRemainingMs,
  type StopwatchState,
  type TimerState,
} from '../lib/clock';

const STORAGE_KEY = '@expo-template/timer/clock-v1';
const DEFAULT_DURATION_MS = 5 * 60_000;
const PRESETS = [1, 5, 10, 25] as const;

type Mode = 'timer' | 'stopwatch';

function formatTimer(milliseconds: number) {
  const totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatStopwatch(milliseconds: number) {
  const tenths = Math.floor(Math.max(0, milliseconds) / 100) % 10;
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const base = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
  return hours > 0 ? `${hours}:${base}` : base;
}

export default function TimerApp() {
  const [mode, setMode] = useState<Mode>('timer');
  const [timer, setTimer] = useState<TimerState>(() => createTimer(DEFAULT_DURATION_MS));
  const [stopwatch, setStopwatch] = useState<StopwatchState>(() => createStopwatch());
  const [now, setNow] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        const restored = deserializeClockState(stored, DEFAULT_DURATION_MS);
        setTimer(restored.timer);
        setStopwatch(restored.stopwatch);
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
    const write = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ timer, stopwatch }));
    }, 150);
    return () => clearTimeout(write);
  }, [timer, stopwatch, hydrated]);

  useEffect(() => {
    const timerActive = timer.startedAtMs !== null && timerRemainingMs(timer, Date.now()) > 0;
    const stopwatchActive = stopwatch.startedAtMs !== null;
    if (!timerActive && !stopwatchActive) return;

    const tick = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (!stopwatchActive && timer.startedAtMs !== null && timerRemainingMs(timer, current) === 0) {
        clearInterval(tick);
      }
    }, 100);
    return () => clearInterval(tick);
  }, [timer, stopwatch]);

  const remaining = timerRemainingMs(timer, now);
  const timerRunning = timer.startedAtMs !== null && remaining > 0;
  const timerFinished = remaining === 0;
  const elapsed = stopwatchElapsedMs(stopwatch, now);
  const stopwatchRunning = stopwatch.startedAtMs !== null;

  const selectPreset = (minutes: number) => {
    setTimer(createTimer(minutes * 60_000));
    setNow(Date.now());
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>TIMER & STOPWATCH</Text>
        <Text style={styles.heading}>Keep time without the noise.</Text>

        <View style={styles.modeRow}>
          {(['timer', 'stopwatch'] as const).map((candidate) => (
            <Pressable
              key={candidate}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === candidate }}
              onPress={() => setMode(candidate)}
              style={({ pressed }) => [styles.modeButton, mode === candidate && styles.modeButtonSelected, pressed && styles.pressed]}>
              <Text style={[styles.modeText, mode === candidate && styles.modeTextSelected]}>
                {candidate === 'timer' ? 'Timer' : 'Stopwatch'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'timer' ? (
          <View style={styles.clockCard}>
            <Text accessibilityLiveRegion="polite" style={styles.clockValue}>{formatTimer(remaining)}</Text>
            <Text style={styles.clockStatus}>{timerFinished ? 'Finished — reset or choose a preset' : timerRunning ? 'Running' : 'Paused'}</Text>

            <View style={styles.presetRow}>
              {PRESETS.map((minutes) => (
                <Pressable
                  key={minutes}
                  onPress={() => selectPreset(minutes)}
                  style={({ pressed }) => [styles.presetButton, timer.durationMs === minutes * 60_000 && styles.presetButtonSelected, pressed && styles.pressed]}>
                  <Text style={[styles.presetText, timer.durationMs === minutes * 60_000 && styles.presetTextSelected]}>{minutes} min</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.actionRow}>
              <Pressable
                disabled={timerFinished && !timerRunning}
                onPress={() => {
                  const current = Date.now();
                  setTimer((value) => timerRunning ? pauseTimer(value, current) : startTimer(value, current));
                  setNow(current);
                }}
                style={({ pressed }) => [styles.primaryButton, timerFinished && !timerRunning && styles.disabled, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>{timerRunning ? 'Pause' : 'Start'}</Text>
              </Pressable>
              <Pressable
                onPress={() => setTimer((value) => resetTimer(value))}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>Reset</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.clockCard}>
            <Text accessibilityLiveRegion="polite" style={styles.clockValue}>{formatStopwatch(elapsed)}</Text>
            <Text style={styles.clockStatus}>{stopwatchRunning ? 'Running' : 'Paused'}</Text>
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => {
                  const current = Date.now();
                  setStopwatch((value) => stopwatchRunning ? pauseStopwatch(value, current) : startStopwatch(value, current));
                  setNow(current);
                }}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>{stopwatchRunning ? 'Pause' : 'Start'}</Text>
              </Pressable>
              <Pressable
                onPress={() => setStopwatch(resetStopwatch())}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>Reset</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.footer}>Time is derived from timestamps, so reopening stays accurate after suspension. This MVP does not schedule background alarms or notifications.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  eyebrow: { color: '#657067', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#1f2921', fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1, marginTop: 8 },
  modeRow: { backgroundColor: '#e9e8e2', borderRadius: 14, flexDirection: 'row', gap: 4, marginTop: 24, padding: 4 },
  modeButton: { alignItems: 'center', borderRadius: 11, flex: 1, paddingVertical: 10 },
  modeButtonSelected: { backgroundColor: '#fff' },
  modeText: { color: '#727972', fontSize: 14, fontWeight: '700' },
  modeTextSelected: { color: '#263029' },
  clockCard: { alignItems: 'center', backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 24, marginTop: 16, padding: 24 },
  clockValue: { color: '#1f2921', fontSize: 64, fontVariant: ['tabular-nums'], fontWeight: '700', letterSpacing: -2, marginTop: 10 },
  clockStatus: { color: '#707770', fontSize: 13, fontWeight: '600', marginTop: 6 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 26 },
  presetButton: { borderColor: '#cfd3cc', borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  presetButtonSelected: { backgroundColor: '#e1e9df', borderColor: '#adc0ad' },
  presetText: { color: '#687068', fontSize: 13, fontWeight: '700' },
  presetTextSelected: { color: '#294331' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 28, width: '100%' },
  primaryButton: { alignItems: 'center', backgroundColor: '#243c2b', borderRadius: 14, flex: 1, paddingVertical: 14 },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  secondaryButton: { alignItems: 'center', borderColor: '#b8c0b9', borderWidth: 1, borderRadius: 14, flex: 1, paddingVertical: 14 },
  secondaryButtonText: { color: '#405047', fontWeight: '800' },
  disabled: { opacity: 0.4 },
  footer: { color: '#868b86', fontSize: 12, lineHeight: 18, marginTop: 26 },
  pressed: { opacity: 0.68 },
});
