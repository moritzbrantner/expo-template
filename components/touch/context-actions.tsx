import { PropsWithChildren, ReactNode, useCallback, useMemo, useState } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import {
  isFlick,
  radialActionIndex,
  resolveReachPlacement,
  TOUCH_INTERACTION_POLICY,
  TouchPoint,
} from '@/lib/touch-interactions';

import { triggerSemanticHaptic } from './haptics';
import { useTouchInteractionConfig } from './provider';

export type SwipeAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type SwipeActionsProps = PropsWithChildren<{
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  threshold?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function SwipeActions({
  children,
  leftAction,
  rightAction,
  threshold = TOUCH_INTERACTION_POLICY.swipeThreshold,
  style,
}: SwipeActionsProps) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();
  const [translation, setTranslation] = useState(0);
  const [showFallback, setShowFallback] = useState(false);

  const invoke = useCallback(
    (action: SwipeAction | undefined) => {
      if (!action) {
        return;
      }
      action.onPress();
      void triggerSemanticHaptic(action.destructive ? 'warning' : 'snap', hapticsEnabled);
    },
    [hapticsEnabled],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .runOnJS(true)
        .onUpdate((event) => setTranslation(event.translationX))
        .onEnd((event) => {
          if (event.translationX >= threshold) {
            invoke(leftAction);
          } else if (event.translationX <= -threshold) {
            invoke(rightAction);
          }
          setTranslation(0);
        })
        .onFinalize(() => setTranslation(0)),
    [invoke, leftAction, rightAction, threshold],
  );

  return (
    <View style={[styles.swipeContainer, style]}>
      {leftAction ? (
        <View style={[styles.swipeUnderlay, styles.swipeLeft, { backgroundColor: palette.elevatedSurface }]}>
          <Text style={{ color: leftAction.destructive ? palette.danger : palette.text, fontWeight: '800' }}>
            {leftAction.label}
          </Text>
        </View>
      ) : null}
      {rightAction ? (
        <View style={[styles.swipeUnderlay, styles.swipeRight, { backgroundColor: palette.elevatedSurface }]}>
          <Text style={{ color: rightAction.destructive ? palette.danger : palette.text, fontWeight: '800' }}>
            {rightAction.label}
          </Text>
        </View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <View style={{ transform: [{ translateX: translation }] }}>{children}</View>
      </GestureDetector>
      <Pressable
        accessibilityLabel="Show row actions"
        accessibilityState={{ expanded: showFallback }}
        accessibilityRole="button"
        onPress={() => setShowFallback((current) => !current)}
        style={[
          styles.actionsToggle,
          { borderColor: palette.border, minHeight: minimumTargetSize },
        ]}>
        <Text style={{ color: palette.mutedText, fontWeight: '700' }}>Actions</Text>
      </Pressable>
      {showFallback ? (
        <View style={styles.fallbackActions}>
          {leftAction ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => invoke(leftAction)}
              style={[styles.fallbackAction, { minHeight: minimumTargetSize, borderColor: palette.border }]}>
              <Text style={{ color: leftAction.destructive ? palette.danger : palette.text, fontWeight: '700' }}>
                {leftAction.label}
              </Text>
            </Pressable>
          ) : null}
          {rightAction ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => invoke(rightAction)}
              style={[styles.fallbackAction, { minHeight: minimumTargetSize, borderColor: palette.border }]}>
              <Text style={{ color: rightAction.destructive ? palette.danger : palette.text, fontWeight: '700' }}>
                {rightAction.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export type RadialAction = {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type RadialMenuProps = PropsWithChildren<{
  actions: RadialAction[];
  activationDelayMs?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function RadialMenu({
  children,
  actions,
  activationDelayMs = TOUCH_INTERACTION_POLICY.longPressDelayMs,
  radius = 74,
  style,
}: RadialMenuProps) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();
  const [open, setOpen] = useState(false);
  const [center, setCenter] = useState<TouchPoint>({ x: 0, y: 0 });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const invoke = useCallback(
    (index: number) => {
      const action = actions[index];
      if (!action) {
        return;
      }
      action.onPress();
      void triggerSemanticHaptic(action.destructive ? 'warning' : 'snap', hapticsEnabled);
    },
    [actions, hapticsEnabled],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .minDistance(0)
        .activateAfterLongPress(activationDelayMs)
        .runOnJS(true)
        .onBegin((event) => {
          setCenter({ x: event.x, y: event.y });
          setSelectedIndex(null);
          setOpen(true);
        })
        .onUpdate((event) => {
          setSelectedIndex(radialActionIndex(event.translationX, event.translationY, actions.length));
        })
        .onEnd((event) => {
          const index = radialActionIndex(event.translationX, event.translationY, actions.length);
          if (index !== null) {
            invoke(index);
          }
          setOpen(false);
          setSelectedIndex(null);
        })
        .onFinalize(() => {
          setOpen(false);
          setSelectedIndex(null);
        }),
    [actions.length, activationDelayMs, invoke],
  );

  return (
    <View style={[styles.relative, style]}>
      <GestureDetector gesture={gesture}>
        <View accessibilityHint="Hold, drag toward an action, and release" style={styles.fill}>
          {children}
        </View>
      </GestureDetector>
      {open
        ? actions.map((action, index) => {
            const angle = (Math.PI * 2 * index) / actions.length;
            const selected = index === selectedIndex;
            return (
              <View
                key={action.key}
                pointerEvents="none"
                style={[
                  styles.radialItem,
                  {
                    backgroundColor: selected ? palette.accent : palette.surface,
                    borderColor: selected ? palette.accent : palette.border,
                    left: center.x + Math.cos(angle) * radius - 36,
                    top: center.y + Math.sin(angle) * radius - 22,
                  },
                ]}>
                <Text
                  numberOfLines={1}
                  style={{ color: selected ? palette.accentText : palette.text, fontSize: 12, fontWeight: '800' }}>
                  {action.label}
                </Text>
              </View>
            );
          })
        : null}
      <View style={styles.radialFallback}>
        {actions.map((action, index) => (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            onPress={() => invoke(index)}
            style={[
              styles.radialFallbackButton,
              {
                borderColor: palette.border,
                minHeight: minimumTargetSize,
                backgroundColor: action.destructive ? palette.danger : palette.surface,
              },
            ]}>
            <Text style={{ color: action.destructive ? palette.accentText : palette.text, fontWeight: '700' }}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type ReachOverlayProps = PropsWithChildren<{
  renderOverlay: (close: () => void) => ReactNode;
  label?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function ReachOverlay({ children, renderOverlay, label = 'Actions', style }: ReachOverlayProps) {
  const { minimumTargetSize, palette } = useTouchInteractionConfig();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [anchor, setAnchor] = useState<TouchPoint | null>(null);

  const openAtEvent = (event: GestureResponderEvent) => {
    setAnchor({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY });
  };

  const openFallback = () => {
    setAnchor({ x: size.width / 2, y: size.height - minimumTargetSize });
  };

  const close = () => setAnchor(null);
  const placement = anchor ? resolveReachPlacement(anchor, size.width, size.height) : null;

  const placementStyle = placement
    ? {
        left: placement.endsWith('right') ? Math.min(anchor!.x + 12, Math.max(8, size.width - 180)) : undefined,
        right: placement.endsWith('left') ? Math.min(size.width - anchor!.x + 12, Math.max(8, size.width - 180)) : undefined,
        top: placement.startsWith('down') ? anchor!.y + 12 : undefined,
        bottom: placement.startsWith('up') ? Math.max(8, size.height - anchor!.y + 12) : undefined,
      }
    : undefined;

  return (
    <View
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={[styles.relative, style]}>
      <Pressable accessibilityHint="Long press for context actions" onLongPress={openAtEvent} style={styles.fill}>
        {children}
      </Pressable>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={openFallback}
        style={[
          styles.overlayFallback,
          { backgroundColor: palette.surface, borderColor: palette.border, minHeight: minimumTargetSize },
        ]}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>{label}</Text>
      </Pressable>
      {anchor ? (
        <View
          style={[
            styles.reachOverlay,
            { backgroundColor: palette.surface, borderColor: palette.border },
            placementStyle,
          ]}>
          {renderOverlay(close)}
        </View>
      ) : null}
    </View>
  );
}

type EdgeHandleProps = {
  edge?: 'left' | 'right';
  label: string;
  onOpen: () => void;
  threshold?: number;
};

export function EdgeHandle({
  edge = 'left',
  label,
  onOpen,
  threshold = TOUCH_INTERACTION_POLICY.swipeThreshold,
}: EdgeHandleProps) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();
  const direction = edge === 'left' ? 1 : -1;

  const activate = useCallback(() => {
    onOpen();
    void triggerSemanticHaptic('snap', hapticsEnabled);
  }, [hapticsEnabled, onOpen]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .runOnJS(true)
        .onEnd((event) => {
          if (event.translationX * direction >= threshold) {
            activate();
          }
        }),
    [activate, direction, threshold],
  );

  return (
    <GestureDetector gesture={gesture}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={activate}
        style={[
          styles.edgeHandle,
          edge === 'left' ? styles.edgeLeft : styles.edgeRight,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            minHeight: minimumTargetSize * 1.5,
            minWidth: Math.max(24, minimumTargetSize / 2),
          },
        ]}>
        <View style={[styles.edgeGrip, { backgroundColor: palette.mutedText }]} />
      </Pressable>
    </GestureDetector>
  );
}

type FlickSurfaceProps = PropsWithChildren<{
  onFlick: (direction: 'left' | 'right' | 'up' | 'down') => void;
  threshold?: number;
  fallbackLabel?: string;
  fallbackDirection?: 'left' | 'right' | 'up' | 'down';
  style?: StyleProp<ViewStyle>;
}>;

export function FlickSurface({
  children,
  onFlick,
  threshold = TOUCH_INTERACTION_POLICY.flickVelocity,
  fallbackLabel = 'Quick action',
  fallbackDirection = 'right',
  style,
}: FlickSurfaceProps) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();

  const invoke = useCallback(
    (direction: 'left' | 'right' | 'up' | 'down') => {
      onFlick(direction);
      void triggerSemanticHaptic('snap', hapticsEnabled);
    },
    [hapticsEnabled, onFlick],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .runOnJS(true)
        .onEnd((event) => {
          if (!isFlick(event.velocityX, event.velocityY, threshold)) {
            return;
          }
          if (Math.abs(event.velocityX) >= Math.abs(event.velocityY)) {
            invoke(event.velocityX >= 0 ? 'right' : 'left');
          } else {
            invoke(event.velocityY >= 0 ? 'down' : 'up');
          }
        }),
    [invoke, threshold],
  );

  return (
    <View style={style}>
      <GestureDetector gesture={gesture}>
        <View style={styles.fill}>{children}</View>
      </GestureDetector>
      <Pressable
        accessibilityLabel={fallbackLabel}
        accessibilityRole="button"
        onPress={() => invoke(fallbackDirection)}
        style={[
          styles.flickFallback,
          { minHeight: minimumTargetSize, borderColor: palette.border },
        ]}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>{fallbackLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  relative: {
    position: 'relative',
  },
  swipeContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  swipeUnderlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 16,
    position: 'absolute',
    top: 0,
    width: 110,
  },
  swipeLeft: {
    left: 0,
  },
  swipeRight: {
    right: 0,
  },
  actionsToggle: {
    alignItems: 'center',
    borderTopWidth: 1,
    justifyContent: 'center',
  },
  fallbackActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  fallbackAction: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  radialItem: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
    position: 'absolute',
    width: 72,
    zIndex: 10,
  },
  radialFallback: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  radialFallbackButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  overlayFallback: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    bottom: 8,
    justifyContent: 'center',
    paddingHorizontal: 12,
    position: 'absolute',
    right: 8,
  },
  reachOverlay: {
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 180,
    padding: 8,
    position: 'absolute',
    zIndex: 20,
  },
  edgeHandle: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    position: 'absolute',
    top: '35%',
    zIndex: 12,
  },
  edgeLeft: {
    borderBottomRightRadius: 12,
    borderTopRightRadius: 12,
    left: 0,
  },
  edgeRight: {
    borderBottomLeftRadius: 12,
    borderTopLeftRadius: 12,
    right: 0,
  },
  edgeGrip: {
    borderRadius: 999,
    height: 34,
    width: 3,
  },
  flickFallback: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },
});
