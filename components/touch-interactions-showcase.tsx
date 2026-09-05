import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  DragConfirm,
  GestureUndo,
  PrecisionScrubber,
  RadialMenu,
  SegmentedChoice,
  SnapSlider,
  StepControl,
  SwipeActions,
  TouchInteractionProvider,
  ViewportSurface,
} from '@/components/touch';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/hooks/theme-mode';

export function TouchInteractionsShowcase() {
  const { activeTheme } = useThemeMode();
  const palette = Colors[activeTheme];
  const [amount, setAmount] = useState(90);
  const [mode, setMode] = useState<'one' | 'two'>('one');
  const [intensity, setIntensity] = useState(4);
  const [scrubValue, setScrubValue] = useState(30);
  const [feedback, setFeedback] = useState('Try an interaction.');
  const [objectOffset, setObjectOffset] = useState({ x: 0, y: 0 });
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [viewportScale, setViewportScale] = useState(1);
  const [viewportRotation, setViewportRotation] = useState(0);
  const contentStartRef = useRef({ x: 0, y: 0 });

  return (
    <TouchInteractionProvider
      config={{
        palette: {
          accent: palette.accent,
          accentText: activeTheme === 'dark' ? '#0B1114' : '#FFFFFF',
          surface: palette.background,
          elevatedSurface: palette.surface,
          border: palette.border,
          text: palette.text,
          mutedText: palette.mutedText,
          danger: '#B42318',
        },
      }}>
      <View style={styles.root}>
        <View style={styles.heading}>
          <ThemedText style={styles.eyebrow}>Touch interaction layer</ThemedText>
          <ThemedText type="title">Thumb-first, two-finger capable.</ThemedText>
          <ThemedText style={{ color: palette.mutedText }}>
            Important actions keep visible fallbacks; gestures accelerate them instead of hiding them.
          </ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <ThemedText type="subtitle">Tap, hold, and repeat</ThemedText>
          <StepControl
            formatValue={(value) => `${value} ml`}
            label="Amount"
            max={400}
            min={0}
            onChange={setAmount}
            steps={[-10, -5, 5, 10]}
            value={amount}
          />
          <SegmentedChoice<'one' | 'two'>
            label="Interaction mode"
            onChange={setMode}
            options={[
              { label: 'One finger', value: 'one' },
              { label: 'Two fingers', value: 'two' },
            ]}
            value={mode}
          />
        </View>

        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <ThemedText type="subtitle">Preview while moving, commit on release</ThemedText>
          <SnapSlider
            label="Intensity"
            max={10}
            min={0}
            onCommit={setIntensity}
            step={1}
            value={intensity}
          />
          <PrecisionScrubber
            baseStep={1}
            label="Timeline"
            max={120}
            min={0}
            onCommit={setScrubValue}
            value={scrubValue}
          />
        </View>

        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <ThemedText type="subtitle">Context without permanent clutter</ThemedText>
          <SwipeActions
            leftAction={{ label: 'Pin', onPress: () => setFeedback('Pinned from swipe.') }}
            rightAction={{ label: 'Archive', onPress: () => setFeedback('Archived from swipe.') }}>
            <View style={[styles.demoRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <ThemedText type="defaultSemiBold">Swipe this row</ThemedText>
              <ThemedText style={{ color: palette.mutedText }}>Visible Actions fallback below</ThemedText>
            </View>
          </SwipeActions>
          <RadialMenu
            actions={[
              { key: 'move', label: 'Move', onPress: () => setFeedback('Move selected.') },
              { key: 'copy', label: 'Copy', onPress: () => setFeedback('Copy selected.') },
              { key: 'hide', label: 'Hide', onPress: () => setFeedback('Hide selected.') },
            ]}>
            <View style={[styles.radialTarget, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <ThemedText type="defaultSemiBold">Hold, drag, release</ThemedText>
              <ThemedText style={{ color: palette.mutedText }}>Or use the visible action buttons</ThemedText>
            </View>
          </RadialMenu>
          <ThemedText style={{ color: palette.mutedText }}>{feedback}</ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <ThemedText type="subtitle">One finger = content, two fingers = viewport</ThemedText>
          <GestureUndo onUndo={() => setFeedback('Undo activated.')}>
            <ViewportSurface
              onContentDrag={(snapshot) =>
                setObjectOffset({
                  x: contentStartRef.current.x + snapshot.translationX,
                  y: contentStartRef.current.y + snapshot.translationY,
                })
              }
              onContentDrop={() => {
                contentStartRef.current = objectOffset;
              }}
              onViewportPan={(x, y) => setViewportOffset({ x, y })}
              onViewportRotate={setViewportRotation}
              onViewportScale={setViewportScale}
              style={[styles.viewport, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <View
                style={[
                  styles.viewportContent,
                  {
                    transform: [
                      { translateX: viewportOffset.x },
                      { translateY: viewportOffset.y },
                      { scale: viewportScale },
                      { rotate: `${viewportRotation}rad` },
                    ],
                  },
                ]}>
                <View
                  style={[
                    styles.movableObject,
                    {
                      backgroundColor: palette.accent,
                      transform: [{ translateX: objectOffset.x }, { translateY: objectOffset.y }],
                    },
                  ]}>
                  <Text style={{ color: activeTheme === 'dark' ? '#0B1114' : '#FFFFFF', fontWeight: '800' }}>
                    Drag me
                  </Text>
                </View>
              </View>
            </ViewportSurface>
          </GestureUndo>
          <ThemedText style={{ color: palette.mutedText }}>
            Two-finger tap also triggers Undo; the visible Undo button remains available.
          </ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <ThemedText type="subtitle">Deliberate confirmation</ThemedText>
          <DragConfirm label="Drag to confirm" onConfirm={() => setFeedback('Confirmed deliberately.')} />
        </View>
      </View>
    </TouchInteractionProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 16,
  },
  heading: {
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  section: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  demoRow: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 16,
  },
  radialTarget: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    minHeight: 92,
    justifyContent: 'center',
    padding: 16,
  },
  viewport: {
    borderRadius: 18,
    borderWidth: 1,
    height: 240,
    overflow: 'hidden',
  },
  viewportContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  movableObject: {
    alignItems: 'center',
    borderRadius: 16,
    height: 88,
    justifyContent: 'center',
    width: 112,
  },
});
