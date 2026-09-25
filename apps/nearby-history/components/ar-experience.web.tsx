import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ARTrackingState } from '../lib/ar';
import type { ReconstructionSite } from '../lib/site';

type Props = {
  site: ReconstructionSite;
  blend: number;
  onTrackingState: (state: ARTrackingState) => void;
};

export function ARExperience({ site, blend, onTrackingState }: Props) {
  useEffect(() => {
    onTrackingState('preview');
  }, [onTrackingState]);

  return (
    <View style={styles.scene}>
      <View style={styles.sky} />
      <View style={styles.street} />

      <View style={styles.presentFacade}>
        <View style={styles.presentRoof} />
        <View style={styles.windowRow}>
          <View style={styles.window} />
          <View style={styles.window} />
          <View style={styles.window} />
        </View>
        <View style={styles.presentDoor} />
      </View>

      <View pointerEvents="none" style={[styles.reconstruction, { opacity: blend }]}>
        <View style={[styles.fixturePillar, styles.fixtureLeft]} />
        <View style={[styles.fixturePillar, styles.fixtureRight]} />
        <View style={styles.fixtureLintel} />
        <View style={styles.fixtureRoof} />
      </View>

      <View style={styles.previewBadge}>
        <Text style={styles.previewBadgeText}>WEB PREVIEW · NO CAMERA TRACKING</Text>
      </View>
      <View style={styles.fixtureLabel}>
        <Text style={styles.fixtureLabelTitle}>{site.periodLabel}</Text>
        <Text style={styles.fixtureLabelText}>Procedural geometry · not historical evidence</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    backgroundColor: '#98a5ad',
    flex: 1,
    minHeight: 520,
    overflow: 'hidden',
    position: 'relative',
  },
  sky: {
    backgroundColor: '#9caab3',
    height: '42%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  street: {
    backgroundColor: '#3f4447',
    bottom: 0,
    height: '29%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  presentFacade: {
    alignItems: 'center',
    backgroundColor: '#7d756c',
    bottom: '19%',
    height: '56%',
    left: '17%',
    position: 'absolute',
    width: '66%',
  },
  presentRoof: {
    backgroundColor: '#51463f',
    height: 28,
    left: -16,
    position: 'absolute',
    right: -16,
    top: -28,
  },
  windowRow: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
    marginTop: 82,
    width: '100%',
  },
  window: {
    backgroundColor: '#2d3438',
    borderColor: '#b8afa3',
    borderWidth: 4,
    height: 76,
    width: 48,
  },
  presentDoor: {
    backgroundColor: '#40362f',
    bottom: 0,
    height: 110,
    position: 'absolute',
    width: 72,
  },
  reconstruction: {
    bottom: '18%',
    height: '59%',
    left: '14%',
    position: 'absolute',
    width: '72%',
  },
  fixturePillar: {
    backgroundColor: '#d5c7b0',
    bottom: 0,
    height: '80%',
    position: 'absolute',
    width: '22%',
  },
  fixtureLeft: {
    left: 0,
  },
  fixtureRight: {
    right: 0,
  },
  fixtureLintel: {
    backgroundColor: '#d5c7b0',
    height: '16%',
    left: '16%',
    position: 'absolute',
    right: '16%',
    top: '18%',
  },
  fixtureRoof: {
    backgroundColor: '#876b58',
    height: '12%',
    left: '3%',
    position: 'absolute',
    right: '3%',
    top: 0,
  },
  previewBadge: {
    backgroundColor: 'rgba(13, 17, 20, 0.78)',
    borderRadius: 999,
    left: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    top: 18,
  },
  previewBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  fixtureLabel: {
    backgroundColor: 'rgba(13, 17, 20, 0.76)',
    borderRadius: 14,
    bottom: 18,
    left: 18,
    maxWidth: 290,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'absolute',
  },
  fixtureLabelTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  fixtureLabelText: {
    color: '#c8d0d7',
    fontSize: 11,
    marginTop: 3,
  },
});
