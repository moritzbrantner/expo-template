import { PropsWithChildren, ReactNode, useMemo, useRef, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import {
  clampNumber,
  normalizeSelectionRect,
  TouchPoint,
  TouchRect,
} from '@/lib/touch-interactions';

import { triggerSemanticHaptic } from './haptics';
import { useTouchInteractionConfig } from './provider';

export type DragSnapshot = {
  x: number;
  y: number;
  translationX: number;
  translationY: number;
  velocityX: number;
  velocityY: number;
};

type DragSurfaceProps = PropsWithChildren<{
  onDragStart?: (snapshot: DragSnapshot) => void;
  onDrag?: (snapshot: DragSnapshot) => void;
  onDrop?: (snapshot: DragSnapshot) => void;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}>;

function toDragSnapshot(event: {
  x: number;
  y: number;
  translationX: number;
  translationY: number;
  velocityX: number;
  velocityY: number;
}): DragSnapshot {
  return {
    x: event.x,
    y: event.y,
    translationX: event.translationX,
    translationY: event.translationY,
    velocityX: event.velocityX,
    velocityY: event.velocityY,
  };
}

export function DragSurface({
  children,
  onDragStart,
  onDrag,
  onDrop,
  enabled = true,
  style,
  accessibilityLabel = 'Draggable content',
}: DragSurfaceProps) {
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .maxPointers(1)
        .runOnJS(true)
        .onBegin((event) => onDragStart?.(toDragSnapshot(event)))
        .onUpdate((event) => onDrag?.(toDragSnapshot(event)))
        .onEnd((event) => onDrop?.(toDragSnapshot(event))),
    [enabled, onDrag, onDragStart, onDrop],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View accessibilityLabel={accessibilityLabel} style={style}>
        {children}
      </View>
    </GestureDetector>
  );
}

type PinchSurfaceProps = PropsWithChildren<{
  scale: number;
  minScale?: number;
  maxScale?: number;
  step?: number;
  onPreviewScale?: (scale: number) => void;
  onCommitScale: (scale: number) => void;
  showFallbackControls?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function PinchSurface({
  children,
  scale,
  minScale = 0.5,
  maxScale = 4,
  step = 0.25,
  onPreviewScale,
  onCommitScale,
  showFallbackControls = true,
  style,
}: PinchSurfaceProps) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();
  const [previewScale, setPreviewScale] = useState(scale);
  const startScaleRef = useRef(scale);
  const currentScaleRef = useRef(scale);

  const preview = (next: number) => {
    currentScaleRef.current = next;
    setPreviewScale(next);
    onPreviewScale?.(next);
  };

  const commit = (next = currentScaleRef.current) => {
    currentScaleRef.current = next;
    setPreviewScale(next);
    onCommitScale(next);
    void triggerSemanticHaptic('snap', hapticsEnabled);
  };

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .onBegin(() => {
          startScaleRef.current = scale;
          currentScaleRef.current = scale;
        })
        .onUpdate((event) => preview(clampNumber(startScaleRef.current * event.scale, minScale, maxScale)))
        .onEnd(() => commit()),
    [scale, minScale, maxScale, hapticsEnabled, onPreviewScale, onCommitScale],
  );

  const adjust = (delta: number) => {
    const next = clampNumber(currentScaleRef.current + delta, minScale, maxScale);
    preview(next);
    commit(next);
  };

  return (
    <View style={style}>
      <GestureDetector gesture={pinch}>
        <View
          accessibilityHint="Pinch to change scale"
          accessibilityLabel={`Scale ${previewScale.toFixed(2)}`}
          style={styles.fill}>
          {children}
        </View>
      </GestureDetector>
      {showFallbackControls ? (
        <View style={styles.pinchFallback}>
          <Pressable
            accessibilityLabel="Zoom out"
            accessibilityRole="button"
            onPress={() => adjust(-step)}
            style={[
              styles.roundButton,
              { backgroundColor: palette.surface, borderColor: palette.border, minHeight: minimumTargetSize, minWidth: minimumTargetSize },
            ]}>
            <Text style={[styles.roundButtonText, { color: palette.text }]}>−</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Zoom in"
            accessibilityRole="button"
            onPress={() => adjust(step)}
            style={[
              styles.roundButton,
              { backgroundColor: palette.surface, borderColor: palette.border, minHeight: minimumTargetSize, minWidth: minimumTargetSize },
            ]}>
            <Text style={[styles.roundButtonText, { color: palette.text }]}>+</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

type ViewportSurfaceProps = PropsWithChildren<{
  onContentDrag?: (snapshot: DragSnapshot) => void;
  onContentDrop?: (snapshot: DragSnapshot) => void;
  onViewportPan?: (translationX: number, translationY: number) => void;
  onViewportScale?: (scale: number) => void;
  onViewportRotate?: (rotationRadians: number) => void;
  style?: StyleProp<ViewStyle>;
}>;

export function ViewportSurface({
  children,
  onContentDrag,
  onContentDrop,
  onViewportPan,
  onViewportScale,
  onViewportRotate,
  style,
}: ViewportSurfaceProps) {
  const content = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .runOnJS(true)
        .onUpdate((event) => onContentDrag?.(toDragSnapshot(event)))
        .onEnd((event) => onContentDrop?.(toDragSnapshot(event))),
    [onContentDrag, onContentDrop],
  );

  const viewportPan = useMemo(
    () =>
      Gesture.Pan()
        .minPointers(2)
        .runOnJS(true)
        .onUpdate((event) => onViewportPan?.(event.translationX, event.translationY)),
    [onViewportPan],
  );

  const viewportScale = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .onUpdate((event) => onViewportScale?.(event.scale)),
    [onViewportScale],
  );

  const viewportRotate = useMemo(
    () =>
      Gesture.Rotation()
        .runOnJS(true)
        .onUpdate((event) => onViewportRotate?.(event.rotation)),
    [onViewportRotate],
  );

  const gesture = useMemo(
    () => Gesture.Simultaneous(content, viewportPan, viewportScale, viewportRotate),
    [content, viewportPan, viewportScale, viewportRotate],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessibilityHint="One finger manipulates content. Two fingers pan, pinch, or rotate the viewport."
        style={style}>
        {children}
      </View>
    </GestureDetector>
  );
}

type GestureSelectionProps = PropsWithChildren<{
  onSelect: (rect: TouchRect) => void;
  renderSelection?: (rect: TouchRect) => ReactNode;
  style?: StyleProp<ViewStyle>;
}>;

export function GestureSelection({
  children,
  onSelect,
  renderSelection,
  style,
}: GestureSelectionProps) {
  const { hapticsEnabled, minimumTargetSize, palette } = useTouchInteractionConfig();
  const [selectionMode, setSelectionMode] = useState(false);
  const [rect, setRect] = useState<TouchRect | null>(null);
  const startRef = useRef<TouchPoint>({ x: 0, y: 0 });
  const rectRef = useRef<TouchRect | null>(null);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minPointers(selectionMode ? 1 : 2)
        .runOnJS(true)
        .onBegin((event) => {
          startRef.current = { x: event.x, y: event.y };
          const next = normalizeSelectionRect(startRef.current, startRef.current);
          rectRef.current = next;
          setRect(next);
        })
        .onUpdate((event) => {
          const next = normalizeSelectionRect(startRef.current, { x: event.x, y: event.y });
          rectRef.current = next;
          setRect(next);
        })
        .onEnd(() => {
          const completed = rectRef.current;
          setRect(null);
          if (completed && completed.width >= 8 && completed.height >= 8) {
            onSelect(completed);
            void triggerSemanticHaptic('snap', hapticsEnabled);
          }
        }),
    [selectionMode, onSelect, hapticsEnabled],
  );

  return (
    <View style={[styles.relative, style]}>
      <GestureDetector gesture={gesture}>
        <View style={styles.fill}>{children}</View>
      </GestureDetector>
      {rect ? (
        renderSelection?.(rect) ?? (
          <View
            pointerEvents="none"
            style={[
              styles.selection,
              {
                borderColor: palette.accent,
                height: rect.height,
                left: rect.x,
                top: rect.y,
                width: rect.width,
              },
            ]}
          />
        )
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: selectionMode }}
        onPress={() => setSelectionMode((current) => !current)}
        style={[
          styles.selectionFallback,
          {
            backgroundColor: selectionMode ? palette.accent : palette.surface,
            borderColor: palette.border,
            minHeight: minimumTargetSize,
          },
        ]}>
        <Text style={{ color: selectionMode ? palette.accentText : palette.text, fontWeight: '700' }}>
          {selectionMode ? 'Selection on' : 'Select'}
        </Text>
      </Pressable>
    </View>
  );
}

type TouchPreviewProps = PropsWithChildren<{
  renderPreview: (point: TouchPoint) => ReactNode;
  offset?: TouchPoint;
  onPointChange?: (point: TouchPoint | null) => void;
  style?: StyleProp<ViewStyle>;
}>;

export function TouchPreview({
  children,
  renderPreview,
  offset = { x: 0, y: -72 },
  onPointChange,
  style,
}: TouchPreviewProps) {
  const [point, setPoint] = useState<TouchPoint | null>(null);

  const update = (next: TouchPoint | null) => {
    setPoint(next);
    onPointChange?.(next);
  };

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .minDistance(0)
        .runOnJS(true)
        .onBegin((event) => update({ x: event.x, y: event.y }))
        .onUpdate((event) => update({ x: event.x, y: event.y }))
        .onFinalize(() => update(null)),
    [onPointChange, offset.x, offset.y],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.relative, style]}>
        {children}
        {point ? (
          <View
            pointerEvents="none"
            style={[styles.preview, { left: point.x + offset.x, top: point.y + offset.y }]}>
            {renderPreview(point)}
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

type RemoteHandleProps = PropsWithChildren<{
  offset?: TouchPoint;
  onTargetChange: (target: TouchPoint | null) => void;
  renderTarget?: (target: TouchPoint) => ReactNode;
  style?: StyleProp<ViewStyle>;
}>;

export function RemoteHandle({
  children,
  offset = { x: 0, y: -56 },
  onTargetChange,
  renderTarget,
  style,
}: RemoteHandleProps) {
  const [target, setTarget] = useState<TouchPoint | null>(null);

  const update = (point: TouchPoint | null) => {
    const next = point ? { x: point.x + offset.x, y: point.y + offset.y } : null;
    setTarget(next);
    onTargetChange(next);
  };

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .minDistance(0)
        .runOnJS(true)
        .onBegin((event) => update({ x: event.x, y: event.y }))
        .onUpdate((event) => update({ x: event.x, y: event.y }))
        .onFinalize(() => update(null)),
    [offset.x, offset.y, onTargetChange],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.relative, style]}>
        {children}
        {target ? (
          <View pointerEvents="none" style={[styles.remoteTarget, { left: target.x, top: target.y }]}>
            {renderTarget?.(target) ?? <View style={styles.targetDot} />}
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

export const Magnifier = TouchPreview;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  relative: {
    position: 'relative',
  },
  pinchFallback: {
    bottom: 8,
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    right: 8,
  },
  roundButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  roundButtonText: {
    fontSize: 22,
    fontWeight: '700',
  },
  selection: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderRadius: 6,
    borderWidth: 2,
    position: 'absolute',
  },
  selectionFallback: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    bottom: 8,
    justifyContent: 'center',
    paddingHorizontal: 14,
    position: 'absolute',
    right: 8,
  },
  preview: {
    position: 'absolute',
    zIndex: 20,
  },
  remoteTarget: {
    marginLeft: -9,
    marginTop: -9,
    position: 'absolute',
  },
  targetDot: {
    backgroundColor: '#2563EB',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 2,
    height: 18,
    width: 18,
  },
});
