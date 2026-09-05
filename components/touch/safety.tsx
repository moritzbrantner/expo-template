import { PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { clampNumber } from '@/lib/touch-interactions';

import { triggerSemanticHaptic } from './haptics';
import { useTouchInteractionConfig } from './provider';

type DragConfirmProps = {
  label: string;
  onConfirm: () => void;
  threshold?: number;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function DragConfirm({
  label,
  onConfirm,
  threshold = 0.84,
  destructive = false,
  style,
}: DragConfirmProps) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();
  const [width, setWidth] = useState(0);
  const [progress, setProgress] = useState(0);

  const confirm = useCallback(() => {
    onConfirm();
    void triggerSemanticHaptic(destructive ? 'warning' : 'success', hapticsEnabled);
  }, [destructive, hapticsEnabled, onConfirm]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .minDistance(0)
        .runOnJS(true)
        .onUpdate((event) => setProgress(clampNumber(width <= 0 ? 0 : event.x / width, 0, 1)))
        .onEnd((event) => {
          const completedProgress = clampNumber(width <= 0 ? 0 : event.x / width, 0, 1);
          if (completedProgress >= threshold) {
            confirm();
          } else if (completedProgress > 0) {
            void triggerSemanticHaptic('reject', hapticsEnabled);
          }
          setProgress(0);
        })
        .onFinalize(() => setProgress(0)),
    [confirm, hapticsEnabled, threshold, width],
  );

  const knobSize = minimumTargetSize;
  const travel = Math.max(0, width - knobSize - 8);

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessibilityActions={[{ name: 'activate', label }]}
        accessibilityHint="Drag the handle to the far edge to confirm"
        accessibilityLabel={label}
        accessibilityRole="button"
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') {
            confirm();
          }
        }}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        style={[
          styles.confirmTrack,
          {
            backgroundColor: palette.elevatedSurface,
            borderColor: destructive ? palette.danger : palette.border,
            minHeight: minimumTargetSize + 8,
          },
          style,
        ]}>
        <View
          style={[
            styles.confirmFill,
            {
              backgroundColor: destructive ? palette.danger : palette.accent,
              width: `${progress * 100}%`,
            },
          ]}
        />
        <Text style={[styles.confirmLabel, { color: palette.text }]}>{label}</Text>
        <View
          style={[
            styles.confirmKnob,
            {
              backgroundColor: destructive ? palette.danger : palette.accent,
              height: knobSize,
              transform: [{ translateX: progress * travel }],
              width: knobSize,
            },
          ]}>
          <Text style={{ color: palette.accentText, fontSize: 20, fontWeight: '800' }}>›</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

type GestureUndoProps = PropsWithChildren<{
  onUndo: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function GestureUndo({ children, onUndo, label = 'Undo', style }: GestureUndoProps) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();

  const undo = useCallback(() => {
    onUndo();
    void triggerSemanticHaptic('snap', hapticsEnabled);
  }, [hapticsEnabled, onUndo]);

  const gesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfPointers(2)
        .runOnJS(true)
        .onEnd((_event, success) => {
          if (success) {
            undo();
          }
        }),
    [undo],
  );

  return (
    <View style={[styles.undoContainer, style]}>
      <GestureDetector gesture={gesture}>
        <View accessibilityHint="Two-finger tap to undo" style={styles.fill}>
          {children}
        </View>
      </GestureDetector>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={undo}
        style={[
          styles.undoButton,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            minHeight: minimumTargetSize,
          },
        ]}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  confirmTrack: {
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 4,
    position: 'relative',
  },
  confirmFill: {
    bottom: 0,
    left: 0,
    opacity: 0.16,
    position: 'absolute',
    top: 0,
  },
  confirmLabel: {
    alignSelf: 'center',
    fontSize: 14,
    fontWeight: '800',
    position: 'absolute',
  },
  confirmKnob: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
  },
  undoContainer: {
    position: 'relative',
  },
  undoButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    position: 'absolute',
    right: 8,
    top: 8,
  },
});
