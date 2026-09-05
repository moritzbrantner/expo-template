import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import {
  clampNumber,
  precisionScaleForOffset,
  snapValue,
  valueFromTrackPosition,
} from '@/lib/touch-interactions';

import { triggerSemanticHaptic } from './haptics';
import { useTouchInteractionConfig } from './provider';

type SnapSliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  onPreview?: (value: number) => void;
  onCommit: (value: number) => void;
  formatValue?: (value: number) => string;
};

export function SnapSlider({
  value,
  min,
  max,
  step = 1,
  label,
  onPreview,
  onCommit,
  formatValue = String,
}: SnapSliderProps) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();
  const [trackWidth, setTrackWidth] = useState(0);
  const [previewValue, setPreviewValue] = useState(value);
  const currentRef = useRef(value);
  const lastHapticRef = useRef(value);

  useEffect(() => {
    currentRef.current = value;
    lastHapticRef.current = value;
    setPreviewValue(value);
  }, [value]);

  const preview = (next: number) => {
    currentRef.current = next;
    setPreviewValue(next);
    onPreview?.(next);
    if (next !== lastHapticRef.current) {
      lastHapticRef.current = next;
      void triggerSemanticHaptic('tick', hapticsEnabled);
    }
  };

  const commit = (next = currentRef.current) => {
    const snapped = snapValue(next, min, max, step);
    currentRef.current = snapped;
    setPreviewValue(snapped);
    onCommit(snapped);
    void triggerSemanticHaptic('snap', hapticsEnabled);
  };

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .minDistance(0)
        .runOnJS(true)
        .onBegin((event) => preview(valueFromTrackPosition(event.x, trackWidth, min, max, step)))
        .onUpdate((event) => preview(valueFromTrackPosition(event.x, trackWidth, min, max, step)))
        .onEnd(() => commit()),
    [trackWidth, min, max, step, value, hapticsEnabled, onPreview, onCommit],
  );

  const adjust = (delta: number) => {
    const next = snapValue(currentRef.current + delta, min, max, step);
    preview(next);
    commit(next);
  };

  const ratio = max === min ? 0 : clampNumber((previewValue - min) / (max - min), 0, 1);

  return (
    <View accessibilityLabel={`${label}: ${formatValue(previewValue)}`} style={styles.sliderGroup}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
        <Text style={[styles.value, { color: palette.text }]}>{formatValue(previewValue)}</Text>
      </View>
      <View style={styles.sliderRow}>
        <Pressable
          accessibilityLabel={`Decrease ${label}`}
          accessibilityRole="button"
          onPress={() => adjust(-step)}
          style={[
            styles.stepButton,
            { minHeight: minimumTargetSize, minWidth: minimumTargetSize, borderColor: palette.border },
          ]}>
          <Text style={[styles.stepText, { color: palette.text }]}>−</Text>
        </Pressable>
        <GestureDetector gesture={gesture}>
          <View
            accessibilityActions={[
              { name: 'increment', label: `Increase ${label}` },
              { name: 'decrement', label: `Decrease ${label}` },
            ]}
            accessibilityRole="adjustable"
            accessibilityValue={{ min, max, now: previewValue, text: formatValue(previewValue) }}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'increment') {
                adjust(step);
              } else if (event.nativeEvent.actionName === 'decrement') {
                adjust(-step);
              }
            }}
            onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
            style={[styles.trackTouchArea, { minHeight: minimumTargetSize }]}>
            <View style={[styles.track, { backgroundColor: palette.elevatedSurface }]}>
              <View style={[styles.trackFill, { backgroundColor: palette.accent, width: `${ratio * 100}%` }]} />
              <View
                style={[
                  styles.thumb,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.accent,
                    left: `${ratio * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        </GestureDetector>
        <Pressable
          accessibilityLabel={`Increase ${label}`}
          accessibilityRole="button"
          onPress={() => adjust(step)}
          style={[
            styles.stepButton,
            { minHeight: minimumTargetSize, minWidth: minimumTargetSize, borderColor: palette.border },
          ]}>
          <Text style={[styles.stepText, { color: palette.text }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

type PrecisionScrubberProps = {
  value: number;
  min: number;
  max: number;
  baseStep?: number;
  pixelsPerStep?: number;
  label: string;
  onPreview?: (value: number) => void;
  onCommit: (value: number) => void;
  formatValue?: (value: number) => string;
};

export function PrecisionScrubber({
  value,
  min,
  max,
  baseStep = 1,
  pixelsPerStep = 16,
  label,
  onPreview,
  onCommit,
  formatValue = String,
}: PrecisionScrubberProps) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();
  const [previewValue, setPreviewValue] = useState(value);
  const [precisionScale, setPrecisionScale] = useState(1);
  const startValueRef = useRef(value);
  const currentRef = useRef(value);
  const lastHapticRef = useRef(value);

  useEffect(() => {
    startValueRef.current = value;
    currentRef.current = value;
    lastHapticRef.current = value;
    setPreviewValue(value);
  }, [value]);

  const preview = (next: number) => {
    currentRef.current = next;
    setPreviewValue(next);
    onPreview?.(next);
    if (next !== lastHapticRef.current) {
      lastHapticRef.current = next;
      void triggerSemanticHaptic('tick', hapticsEnabled);
    }
  };

  const commit = (next = currentRef.current) => {
    currentRef.current = next;
    setPreviewValue(next);
    onCommit(next);
    void triggerSemanticHaptic('snap', hapticsEnabled);
  };

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .runOnJS(true)
        .onBegin(() => {
          startValueRef.current = value;
          currentRef.current = value;
          setPreviewValue(value);
        })
        .onUpdate((event) => {
          const scale = precisionScaleForOffset(event.translationY);
          setPrecisionScale(scale);
          const step = baseStep * scale;
          const stepCount = event.translationX / pixelsPerStep;
          preview(snapValue(startValueRef.current + stepCount * step, min, max, step));
        })
        .onEnd(() => {
          setPrecisionScale(1);
          commit();
        }),
    [value, min, max, baseStep, pixelsPerStep, hapticsEnabled, onPreview, onCommit],
  );

  const fallbackAdjust = (direction: -1 | 1) => {
    const next = snapValue(currentRef.current + direction * baseStep, min, max, baseStep);
    preview(next);
    commit(next);
  };

  return (
    <View style={styles.scrubberGroup}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
        <Text style={[styles.value, { color: palette.text }]}>{formatValue(previewValue)}</Text>
      </View>
      <GestureDetector gesture={gesture}>
        <View
          accessibilityActions={[
            { name: 'increment', label: `Increase ${label}` },
            { name: 'decrement', label: `Decrease ${label}` },
          ]}
          accessibilityHint="Drag horizontally to change. Move upward for fine adjustment or downward for coarse adjustment."
          accessibilityLabel={label}
          accessibilityRole="adjustable"
          accessibilityValue={{ min, max, now: previewValue, text: formatValue(previewValue) }}
          onAccessibilityAction={(event) =>
            fallbackAdjust(event.nativeEvent.actionName === 'decrement' ? -1 : 1)
          }
          style={[
            styles.scrubber,
            { backgroundColor: palette.elevatedSurface, borderColor: palette.border, minHeight: minimumTargetSize * 1.4 },
          ]}>
          <Text style={[styles.scrubberValue, { color: palette.text }]}>{formatValue(previewValue)}</Text>
          <Text style={[styles.scrubberHint, { color: palette.mutedText }]}>
            {precisionScale === 0.1 ? 'fine ×0.1' : precisionScale === 10 ? 'coarse ×10' : 'normal ×1'}
          </Text>
        </View>
      </GestureDetector>
      <View style={styles.fallbackRow}>
        <Pressable
          accessibilityLabel={`Decrease ${label}`}
          accessibilityRole="button"
          onPress={() => fallbackAdjust(-1)}
          style={[styles.fallbackButton, { borderColor: palette.border, minHeight: minimumTargetSize }]}>
          <Text style={[styles.stepText, { color: palette.text }]}>−</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Increase ${label}`}
          accessibilityRole="button"
          onPress={() => fallbackAdjust(1)}
          style={[styles.fallbackButton, { borderColor: palette.border, minHeight: minimumTargetSize }]}>
          <Text style={[styles.stepText, { color: palette.text }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const ThumbSlider = SnapSlider;

const styles = StyleSheet.create({
  sliderGroup: {
    gap: 8,
  },
  sliderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  value: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  sliderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  stepButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 22,
    fontWeight: '700',
  },
  trackTouchArea: {
    flex: 1,
    justifyContent: 'center',
  },
  track: {
    borderRadius: 999,
    height: 8,
    position: 'relative',
  },
  trackFill: {
    borderRadius: 999,
    height: '100%',
  },
  thumb: {
    borderRadius: 999,
    borderWidth: 3,
    height: 26,
    marginLeft: -13,
    marginTop: -17,
    position: 'absolute',
    top: '50%',
    width: 26,
  },
  scrubberGroup: {
    gap: 8,
  },
  scrubber: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    padding: 12,
  },
  scrubberValue: {
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  scrubberHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  fallbackRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fallbackButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
});
