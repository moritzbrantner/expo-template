import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  createStopwatch,
  elapsedAt,
  formatElapsed,
  pauseStopwatch,
  resetStopwatch,
  startStopwatch,
} from '../core/time/stopwatch';

export default function StopwatchScreen() {
  const [stopwatch, setStopwatch] = useState(createStopwatch);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (stopwatch.status !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 30);
    return () => clearInterval(timer);
  }, [stopwatch.status]);

  const elapsed = elapsedAt(stopwatch, now);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Stopwatch' }} />
      <Text accessibilityLabel="Elapsed time" style={styles.time}>
        {formatElapsed(elapsed)}
      </Text>
      <View style={styles.actions}>
        {stopwatch.status === 'running' ? (
          <Action
            label="Pause"
            onPress={() => {
              const timestamp = Date.now();
              setNow(timestamp);
              setStopwatch((current) => pauseStopwatch(current, timestamp));
            }}
          />
        ) : (
          <Action
            label={stopwatch.status === 'paused' ? 'Resume' : 'Start'}
            onPress={() => {
              const timestamp = Date.now();
              setNow(timestamp);
              setStopwatch((current) => startStopwatch(current, timestamp));
            }}
          />
        )}
        <Action
          label="Reset"
          secondary
          onPress={() => {
            setNow(Date.now());
            setStopwatch(resetStopwatch());
          }}
        />
      </View>
    </View>
  );
}

function Action({
  label,
  onPress,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, secondary && styles.secondaryButton]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, padding: 24, backgroundColor: '#101714' },
  time: { color: '#f4f7f5', fontSize: 52, fontVariant: ['tabular-nums'], fontWeight: '300' },
  actions: { flexDirection: 'row', gap: 12 },
  button: { minWidth: 110, alignItems: 'center', borderRadius: 999, padding: 15, backgroundColor: '#75d1b1' },
  secondaryButton: { borderWidth: 1, borderColor: '#75d1b1', backgroundColor: 'transparent' },
  buttonText: { color: '#10221c', fontSize: 16, fontWeight: '800' },
  secondaryButtonText: { color: '#75d1b1' },
});
