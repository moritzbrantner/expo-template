import { useCallback, useState } from 'react';
import {
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { blendLabel, clampBlend } from '../lib/blend';

type Props = {
  value: number;
  onChange: (value: number) => void;
};

const STEP = 0.1;

export function HistoryBlendControl({ value, onChange }: Props) {
  const [trackWidth, setTrackWidth] = useState(1);
  const clamped = clampBlend(value);

  const updateFromTouch = useCallback(
    (event: GestureResponderEvent) => {
      onChange(clampBlend(event.nativeEvent.locationX / trackWidth));
    },
    [onChange, trackWidth],
  );

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'increment') {
        onChange(clampBlend(clamped + STEP));
      }
      if (event.nativeEvent.actionName === 'decrement') {
        onChange(clampBlend(clamped - STEP));
      }
    },
    [clamped, onChange],
  );

  const percentage = `${clamped * 100}%` as `${number}%`;

  return (
    <View style={styles.root}>
      <View style={styles.labels}>
        <Text style={styles.endpoint}>Present</Text>
        <Text style={styles.value}>{blendLabel(clamped)}</Text>
        <Text style={styles.endpoint}>Past</Text>
      </View>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Historical reconstruction visibility"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={handleAccessibilityAction}
        onLayout={(event) => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={updateFromTouch}
        onResponderMove={updateFromTouch}
        style={styles.track}>
        <View style={[styles.fill, { width: percentage }]} />
        <View style={[styles.thumb, { left: percentage }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
  },
  labels: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  endpoint: {
    color: '#c8d0d7',
    fontSize: 12,
    fontWeight: '600',
  },
  value: {
    color: '#ffffff',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  track: {
    backgroundColor: '#39414a',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    overflow: 'visible',
  },
  fill: {
    backgroundColor: '#d5c7b0',
    borderRadius: 999,
    height: 6,
  },
  thumb: {
    backgroundColor: '#ffffff',
    borderColor: '#13171b',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    marginLeft: -10,
    position: 'absolute',
    width: 20,
  },
});
