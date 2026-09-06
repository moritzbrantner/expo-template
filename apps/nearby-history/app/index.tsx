import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ARExperience } from '../components/ar-experience';
import { HistoryBlendControl } from '../components/history-blend-control';
import type { ARTrackingState } from '../lib/ar';
import { calibrationSummary, HORIZON_ONE_SITE } from '../lib/site';
import { styles } from './styles';

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
      <ARExperience blend={blend} onTrackingState={handleTrackingState} site={site} />

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
            <Text style={styles.bottomNote}>Manual origin: {calibrationSummary(site)}</Text>
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
