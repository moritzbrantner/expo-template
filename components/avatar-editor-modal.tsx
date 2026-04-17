import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useThemeMode } from '@/hooks/theme-mode';

const EDITOR_SIZE = 280;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

export type EditableAvatarAsset = {
  uri: string;
  width: number;
  height: number;
};

export type AvatarCropSelection = {
  asset: EditableAvatarAsset;
  crop: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
};

type AvatarEditorModalProps = {
  asset: EditableAvatarAsset | null;
  visible: boolean;
  isSaving?: boolean;
  onCancel: () => void;
  onSave: (selection: AvatarCropSelection) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getEditorMetrics(asset: EditableAvatarAsset | null, zoom: number) {
  if (!asset) {
    return {
      scale: 1,
      width: EDITOR_SIZE,
      height: EDITOR_SIZE,
      maxOffsetX: 0,
      maxOffsetY: 0,
    };
  }

  const baseScale = Math.max(EDITOR_SIZE / asset.width, EDITOR_SIZE / asset.height);
  const scale = baseScale * zoom;
  const width = asset.width * scale;
  const height = asset.height * scale;

  return {
    scale,
    width,
    height,
    maxOffsetX: Math.max(0, (width - EDITOR_SIZE) / 2),
    maxOffsetY: Math.max(0, (height - EDITOR_SIZE) / 2),
  };
}

function clampOffset(
  offset: { x: number; y: number },
  bounds: { maxOffsetX: number; maxOffsetY: number },
) {
  return {
    x: clamp(offset.x, -bounds.maxOffsetX, bounds.maxOffsetX),
    y: clamp(offset.y, -bounds.maxOffsetY, bounds.maxOffsetY),
  };
}

function createCropSelection(
  asset: EditableAvatarAsset,
  zoom: number,
  offset: { x: number; y: number },
): AvatarCropSelection {
  const metrics = getEditorMetrics(asset, zoom);
  const cropSize = Math.min(asset.width, asset.height, Math.round(EDITOR_SIZE / metrics.scale));
  const originX = Math.round(
    clamp((asset.width - cropSize) / 2 - offset.x / metrics.scale, 0, asset.width - cropSize),
  );
  const originY = Math.round(
    clamp((asset.height - cropSize) / 2 - offset.y / metrics.scale, 0, asset.height - cropSize),
  );

  return {
    asset,
    crop: {
      originX,
      originY,
      width: cropSize,
      height: cropSize,
    },
  };
}

export function AvatarEditorModal({
  asset,
  visible,
  isSaving = false,
  onCancel,
  onSave,
}: AvatarEditorModalProps) {
  const borderColor = useThemeColor({}, 'border');
  const mutedTextColor = useThemeColor({}, 'mutedText');
  const accentColor = useThemeColor({}, 'accent');
  const palette = Colors[useThemeMode().activeTheme];
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef(offset);
  const dragOriginRef = useRef(offset);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    if (!visible || !asset) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [asset, visible]);

  const metrics = useMemo(() => getEditorMetrics(asset, zoom), [asset, zoom]);

  useEffect(() => {
    setOffset((currentOffset) => clampOffset(currentOffset, metrics));
  }, [metrics]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => Boolean(asset),
        onStartShouldSetPanResponder: () => Boolean(asset),
        onPanResponderGrant: () => {
          dragOriginRef.current = offsetRef.current;
        },
        onPanResponderMove: (_event, gestureState) => {
          setOffset(
            clampOffset(
              {
                x: dragOriginRef.current.x + gestureState.dx,
                y: dragOriginRef.current.y + gestureState.dy,
              },
              metrics,
            ),
          );
        },
      }),
    [asset, metrics],
  );

  function adjustZoom(delta: number) {
    setZoom((currentZoom) => clamp(Number((currentZoom + delta).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  }

  function handleSave(_event: GestureResponderEvent) {
    if (!asset || isSaving) {
      return;
    }

    onSave(createCropSelection(asset, zoom, offset));
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <ThemedView
          style={[styles.sheet, { borderColor }]}
          lightColor={Colors.light.surface}
          darkColor={Colors.dark.surface}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Edit profile picture</ThemedText>
            <ThemedText style={{ color: mutedTextColor }}>
              Drag the image to reposition it, then zoom until the crop looks right.
            </ThemedText>
          </View>

          <View style={[styles.editorFrame, { borderColor }]}>
            {asset ? (
              <View style={styles.editorViewport} {...panResponder.panHandlers}>
                <Image
                  source={{ uri: asset.uri }}
                  contentFit="cover"
                  style={[
                    styles.editorImage,
                    {
                      width: metrics.width,
                      height: metrics.height,
                      left: (EDITOR_SIZE - metrics.width) / 2 + offset.x,
                      top: (EDITOR_SIZE - metrics.height) / 2 + offset.y,
                    },
                  ]}
                />
                <View pointerEvents="none" style={[styles.cropRing, { borderColor: '#FFFFFF' }]} />
              </View>
            ) : null}
          </View>

          <View style={styles.zoomRow}>
            <Pressable
              accessibilityRole="button"
              disabled={zoom <= MIN_ZOOM || isSaving}
              onPress={() => adjustZoom(-ZOOM_STEP)}
              style={({ pressed }) => [
                styles.controlButton,
                {
                  borderColor,
                  opacity: zoom <= MIN_ZOOM || isSaving ? 0.45 : pressed ? 0.82 : 1,
                },
              ]}>
              <ThemedText type="defaultSemiBold">Zoom out</ThemedText>
            </Pressable>
            <ThemedText style={styles.zoomLabel}>Zoom {zoom.toFixed(2)}x</ThemedText>
            <Pressable
              accessibilityRole="button"
              disabled={zoom >= MAX_ZOOM || isSaving}
              onPress={() => adjustZoom(ZOOM_STEP)}
              style={({ pressed }) => [
                styles.controlButton,
                {
                  borderColor,
                  opacity: zoom >= MAX_ZOOM || isSaving ? 0.45 : pressed ? 0.82 : 1,
                },
              ]}>
              <ThemedText type="defaultSemiBold">Zoom in</ThemedText>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => setOffset({ x: 0, y: 0 })}
            style={({ pressed }) => [
              styles.resetButton,
              {
                borderColor,
                opacity: isSaving ? 0.45 : pressed ? 0.82 : 1,
              },
            ]}>
            <ThemedText type="defaultSemiBold">Center image</ThemedText>
          </Pressable>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.footerButton,
                {
                  borderColor,
                  opacity: isSaving ? 0.45 : pressed ? 0.82 : 1,
                },
              ]}>
              <ThemedText type="defaultSemiBold">Cancel</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!asset || isSaving}
              onPress={handleSave}
              style={({ pressed }) => [
                styles.footerButton,
                styles.primaryButton,
                {
                  backgroundColor: isSaving ? palette.icon : accentColor,
                  opacity: !asset ? 0.45 : pressed ? 0.9 : 1,
                },
              ]}>
              <ThemedText style={styles.primaryLabel}>
                {isSaving ? 'Uploading...' : 'Save photo'}
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  editorFrame: {
    alignSelf: 'center',
    width: EDITOR_SIZE + 12,
    height: EDITOR_SIZE + 12,
    borderRadius: 28,
    borderWidth: 1,
    padding: 6,
    overflow: 'hidden',
  },
  editorViewport: {
    width: EDITOR_SIZE,
    height: EDITOR_SIZE,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  editorImage: {
    position: 'absolute',
  },
  cropRing: {
    position: 'absolute',
    inset: 18,
    borderRadius: 999,
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  zoomLabel: {
    minWidth: 80,
    textAlign: 'center',
  },
  controlButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  resetButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  footerButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButton: {
    borderWidth: 0,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
