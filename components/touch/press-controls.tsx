import { PropsWithChildren, ReactNode, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import {
  repeatIntervalForElapsed,
  TOUCH_INTERACTION_POLICY,
} from '@/lib/touch-interactions';

import { triggerSemanticHaptic } from './haptics';
import { useTouchInteractionConfig } from './provider';

type RepeatButtonProps = {
  label: string;
  onStep: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  initialDelayMs?: number;
  style?: StyleProp<ViewStyle>;
};

export function RepeatButton({
  label,
  onStep,
  disabled = false,
  accessibilityLabel,
  initialDelayMs = TOUCH_INTERACTION_POLICY.repeatInitialDelayMs,
  style,
}: RepeatButtonProps) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(0);
  const activeRef = useRef(false);

  const clearTimer = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const invoke = useCallback(() => {
    onStep();
    void triggerSemanticHaptic('tick', hapticsEnabled);
  }, [hapticsEnabled, onStep]);

  const scheduleRepeat = useCallback(
    function schedule() {
      if (!activeRef.current) {
        return;
      }
      const elapsed = Date.now() - startedAtRef.current;
      timerRef.current = setTimeout(() => {
        if (!activeRef.current) {
          return;
        }
        invoke();
        schedule();
      }, repeatIntervalForElapsed(elapsed));
    },
    [invoke],
  );

  const start = useCallback(() => {
    if (disabled) {
      return;
    }
    clearTimer();
    activeRef.current = true;
    startedAtRef.current = Date.now();
    invoke();
    timerRef.current = setTimeout(scheduleRepeat, initialDelayMs);
  }, [clearTimer, disabled, initialDelayMs, invoke, scheduleRepeat]);

  useEffect(() => clearTimer, [clearTimer]);

  return (
    <Pressable
      accessibilityActions={[{ name: 'activate', label: accessibilityLabel ?? label }]}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onAccessibilityAction={(event) => {
        if (!disabled && event.nativeEvent.actionName === 'activate') {
          invoke();
        }
      }}
      onPressIn={start}
      onPressOut={clearTimer}
      style={[
        styles.compactButton,
        {
          backgroundColor: palette.elevatedSurface,
          borderColor: palette.border,
          minHeight: minimumTargetSize,
          minWidth: minimumTargetSize,
        },
        disabled && styles.disabled,
        style,
      ]}>
      <Text style={[styles.controlText, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

type HoldActionProps = PropsWithChildren<{
  label: string;
  onActivate: () => void;
  delayMs?: number;
  disabled?: boolean;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function HoldAction({
  children,
  label,
  onActivate,
  delayMs = TOUCH_INTERACTION_POLICY.longPressDelayMs,
  disabled = false,
  destructive = false,
  style,
}: HoldActionProps) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();

  const activate = () => {
    onActivate();
    void triggerSemanticHaptic(destructive ? 'warning' : 'success', hapticsEnabled);
  };

  return (
    <Pressable
      accessibilityActions={[{ name: 'activate', label }]}
      accessibilityHint={`Hold for ${Math.round(delayMs / 100) / 10} seconds to activate`}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      delayLongPress={delayMs}
      disabled={disabled}
      onAccessibilityAction={(event) => {
        if (!disabled && event.nativeEvent.actionName === 'activate') {
          activate();
        }
      }}
      onLongPress={activate}
      style={[
        styles.holdButton,
        {
          backgroundColor: destructive ? palette.danger : palette.accent,
          minHeight: minimumTargetSize,
        },
        disabled && styles.disabled,
        style,
      ]}>
      {children ?? <Text style={[styles.holdText, { color: palette.accentText }]}>{label}</Text>}
    </Pressable>
  );
}

type StepControlProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  steps?: number[];
  formatValue?: (value: number) => string;
  label?: string;
};

export function StepControl({
  value,
  onChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  steps = [-5, -1, 1, 5],
  formatValue = String,
  label = 'Value',
}: StepControlProps) {
  const { palette } = useTouchInteractionConfig();

  const changeBy = (delta: number) => {
    onChange(Math.min(max, Math.max(min, value + delta)));
  };

  return (
    <View accessibilityLabel={`${label}: ${formatValue(value)}`} style={styles.stepControl}>
      <View style={styles.stepButtons}>
        {steps
          .filter((step) => step < 0)
          .map((step) => (
            <RepeatButton
              key={step}
              accessibilityLabel={`${label} ${step}`}
              label={String(step)}
              onStep={() => changeBy(step)}
            />
          ))}
      </View>
      <View style={[styles.valueWell, { borderColor: palette.border }]}>
        <Text style={[styles.valueText, { color: palette.text }]}>{formatValue(value)}</Text>
      </View>
      <View style={styles.stepButtons}>
        {steps
          .filter((step) => step > 0)
          .map((step) => (
            <RepeatButton
              key={step}
              accessibilityLabel={`${label} plus ${step}`}
              label={`+${step}`}
              onStep={() => changeBy(step)}
            />
          ))}
      </View>
    </View>
  );
}

type SegmentedChoiceOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedChoiceProps<T extends string> = {
  value: T;
  options: SegmentedChoiceOption<T>[];
  onChange: (value: T) => void;
  label: string;
};

export function SegmentedChoice<T extends string>({
  value,
  options,
  onChange,
  label,
}: SegmentedChoiceProps<T>) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();

  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              onChange(option.value);
              void triggerSemanticHaptic('snap', hapticsEnabled);
            }}
            style={[
              styles.segment,
              {
                backgroundColor: selected ? palette.accent : palette.surface,
                borderColor: palette.border,
                minHeight: minimumTargetSize,
              },
            ]}>
            <Text style={[styles.controlText, { color: selected ? palette.accentText : palette.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type DragHandleProps = {
  label?: string;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function DragHandle({ label = 'Drag to reorder', trailing, style }: DragHandleProps) {
  const { minimumTargetSize, palette } = useTouchInteractionConfig();
  return (
    <View
      accessibilityHint="Use the surrounding drag surface to move this item"
      accessibilityLabel={label}
      style={[
        styles.dragHandle,
        { borderColor: palette.border, minHeight: minimumTargetSize },
        style,
      ]}>
      <View style={styles.grip}>
        <View style={[styles.gripLine, { backgroundColor: palette.mutedText }]} />
        <View style={[styles.gripLine, { backgroundColor: palette.mutedText }]} />
        <View style={[styles.gripLine, { backgroundColor: palette.mutedText }]} />
      </View>
      {trailing}
    </View>
  );
}

type BottomActionShelfAction = {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type BottomActionShelfProps = {
  actions: BottomActionShelfAction[];
  visible?: boolean;
};

export function BottomActionShelf({ actions, visible = true }: BottomActionShelfProps) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();
  if (!visible) {
    return null;
  }

  return (
    <View
      accessibilityLabel="Context actions"
      style={[styles.actionShelf, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          onPress={() => {
            action.onPress();
            void triggerSemanticHaptic(action.destructive ? 'warning' : 'tick', hapticsEnabled);
          }}
          style={[
            styles.shelfAction,
            {
              minHeight: minimumTargetSize,
              backgroundColor: action.destructive ? palette.danger : palette.elevatedSurface,
            },
          ]}>
          <Text style={{ color: action.destructive ? palette.accentText : palette.text, fontWeight: '700' }}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  compactButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  disabled: {
    opacity: 0.45,
  },
  controlText: {
    fontSize: 15,
    fontWeight: '700',
  },
  holdButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  holdText: {
    fontSize: 15,
    fontWeight: '800',
  },
  stepControl: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  stepButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  valueWell: {
    alignItems: 'center',
    borderBottomWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 70,
    paddingHorizontal: 8,
  },
  valueText: {
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  segmented: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dragHandle: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  grip: {
    gap: 3,
    width: 28,
  },
  gripLine: {
    borderRadius: 999,
    height: 2,
    width: 28,
  },
  actionShelf: {
    borderRadius: 18,
    borderWidth: 1,
    bottom: 12,
    flexDirection: 'row',
    gap: 8,
    left: 12,
    padding: 8,
    position: 'absolute',
    right: 12,
  },
  shelfAction: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
