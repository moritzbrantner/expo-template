import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ARExperience } from '../components/ar-experience';
import { HistoryBlendControl } from '../components/history-blend-control';
import type { ARTrackingState } from '../lib/ar';
import { calibrationSummary, HORIZON_ONE_SITE } from '../lib/site';

const site = HORIZON_ONE_SITE;

const trackingCopy: Record<ARTrackingState, { label: string; detail: string }> = {
  initializing: {
    label: 'Initializing AR',
    detail: 'Hold the phone steady while the camera establishes world tracking.',
  },
  normal: {
    label: 'Tracking locked',
    detail: 'The reconstruction is world-locked to the manual calibration origin.',
  },
  limited: {
    label: 'Tracking limited',
    detail: 'Move slowly and keep textured parts of the façade in view.',
  },
  unavailable: {
    label: 'Tracking unavailable',
    detail: 'Return to the marked point and restart the aligned view.',
  },
  preview: {
    label: 'Web preview',
    detail: 'This browser build demonstrates blending only; native camera tracking is not running.',
  },
};

function SetupScreen({ onStart }: { onStart: () => void }) {
  return (
    <SafeAreaView style={styles.setupSafeArea}>
      <View style={styles.setupContent}>
        <View>
          <Text style={styles.eyebrow}>HORIZON 1 · MANUAL REGISTRATION</Text>
          <Text style={styles.title}>Nearby History</Text>
          <Text style={styles.lede}>
            Prove one historical reconstruction can stay aligned with a known place before adding
            automatic building recognition.
          </Text>
        </View>

        <View style={styles.siteCard}>
          <Text style={styles.cardLabel}>CURRENT FIELD FIXTURE</Text>
          <Text style={styles.siteName}>{site.name}</Text>
          <Text style={styles.period}>{site.periodLabel}</Text>
          <View style={styles.divider} />
          <Text style={styles.viewpointTitle}>{site.viewingPoint.title}</Text>
          <Text style={styles.bodyCopy}>{site.viewingPoint.instructions}</Text>
          <Text style={styles.calibration}>{calibrationSummary(site)}</Text>
        </View>

        <View style={styles.disclosure}>
          <Text style={styles.disclosureTitle}>Technical demo — not historical evidence</Text>
          <Text style={styles.disclosureCopy}>{site.evidence.note}</Text>
        </View>

        <View style={styles.boundary}>
          <Text style={styles.boundaryTitle}>This horizon intentionally excludes</Text>
          <Text style={styles.boundaryCopy}>
            building recognition · GPS/VPS alignment · façade matching · depth occlusion · multiple
            sites
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onStart}
          style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}>
          <Text style={styles.startButtonText}>
            {Platform.OS === 'web' ? 'Open blend preview' : 'Start aligned view'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function AlignedView({ onExit }: { onExit: () => void }) {
  const [blend, setBlend] = useState(0.68);
  const [tracking, setTracking] = useState<ARTrackingState>('initializing');
  const handleTrackingState = useCallback((state: ARTrackingState) => setTracking(state), []);
  const copy = trackingCopy[tracking];

  return (
    <View style={styles.arRoot}>
      <ARExperience
        blend={blend}
        onTrackingState={handleTrackingState}
        site={site}
      />

      <SafeAreaView pointerEvents="box-none" style={styles.arOverlay}>
        <View pointerEvents="box-none" style={styles.overlayLayout}>
          <View style={styles.topRow}>
            <View style={styles.trackingCard}>
              <Text style={styles.trackingLabel}>{copy.label}</Text>
              <Text style={styles.trackingDetail}>{copy.detail}</Text>
            </View>
            <Pressable
              accessibilityLabel="Return to setup"
              accessibilityRole="button"
              onPress={onExit}
              style={({ pressed }) => [styles.exitButton, pressed && styles.pressed]}>
              <Text style={styles.exitButtonText}>Exit</Text>
            </Pressable>
          </View>

          <View style={styles.bottomPanel}>
            <View style={styles.bottomHeader}>
              <View style={styles.bottomHeaderCopy}>
                <Text style={styles.bottomEyebrow}>PRESENT ↔ PAST</Text>
                <Text style={styles.bottomTitle}>{site.name}</Text>
              </View>
              <Text style={styles.fixtureChip}>FIXTURE</Text>
            </View>
            <HistoryBlendControl onChange={setBlend} value={blend} />
            <Text style={styles.bottomNote}>
              Manual origin: {calibrationSummary(site)}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function NearbyHistoryApp() {
  const [started, setStarted] = useState(false);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {started ? (
        <AlignedView onExit={() => setStarted(false)} />
      ) : (
        <SetupScreen onStart={() => setStarted(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#111417',
    flex: 1,
  },
  setupSafeArea: {
    backgroundColor: '#111417',
    flex: 1,
  },
  setupContent: {
    alignSelf: 'center',
    flex: 1,
    gap: 22,
    justifyContent: 'center',
    maxWidth: 620,
    paddingHorizontal: 22,
    paddingVertical: 28,
    width: '100%',
  },
  eyebrow: {
    color: '#aeb7be',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginTop: 8,
  },
  lede: {
    color: '#c7ced3',
    fontSize: 17,
    lineHeight: 25,
    marginTop: 12,
    maxWidth: 560,
  },
  siteCard: {
    backgroundColor: '#1a1f23',
    borderColor: '#30383e',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  cardLabel: {
    color: '#98a3aa',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  siteName: {
    color: '#ffffff',
    fontSize: 23,
    fontWeight: '750',
    marginTop: 8,
  },
  period: {
    color: '#c8bca9',
    fontSize: 14,
    marginTop: 4,
  },
  divider: {
    backgroundColor: '#30383e',
    height: 1,
    marginVertical: 17,
  },
  viewpointTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  bodyCopy: {
    color: '#bdc5ca',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  calibration: {
    color: '#879198',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    marginTop: 14,
  },
  disclosure: {
    borderLeftColor: '#c8bca9',
    borderLeftWidth: 3,
    paddingLeft: 14,
  },
  disclosureTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  disclosureCopy: {
    color: '#aeb7be',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  boundary: {
    gap: 5,
  },
  boundaryTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  boundaryCopy: {
    color: '#89939a',
    fontSize: 12,
    lineHeight: 18,
  },
  startButton: {
    alignItems: 'center',
    backgroundColor: '#e4ddd2',
    borderRadius: 16,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  startButtonText: {
    color: '#171a1d',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
  arRoot: {
    backgroundColor: '#000000',
    flex: 1,
  },
  arOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  overlayLayout: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  trackingCard: {
    backgroundColor: 'rgba(15, 18, 21, 0.82)',
    borderRadius: 14,
    maxWidth: 330,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  trackingLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  trackingDetail: {
    color: '#c5cdd2',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  exitButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 18, 21, 0.82)',
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
    minWidth: 62,
    paddingHorizontal: 14,
  },
  exitButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomPanel: {
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 18, 21, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    maxWidth: 620,
    padding: 16,
    width: '100%',
  },
  bottomHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  bottomHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  bottomEyebrow: {
    color: '#98a3aa',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bottomTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 3,
  },
  fixtureChip: {
    borderColor: '#776f65',
    borderRadius: 999,
    borderWidth: 1,
    color: '#d7cbbb',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  bottomNote: {
    color: '#879198',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 10,
  },
});
