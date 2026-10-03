import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deserializeFeedingLog, emptyFeedingLog, type FeedingLog } from '../lib/feeding';
import {
  BABY_FEEDING_STORAGE_KEY,
  buildSharedFeedingUrl,
  decodeSharedFeedingLog,
  feedingLogsEqual,
} from '../lib/sharing';

function normalizedParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatSnapshotTime(log: FeedingLog): string {
  const latest = log.entries.at(-1);
  if (!latest) return 'No records';
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(latest.occurredAt));
}

export default function ShareFeedingLogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ state?: string | string[]; invalid?: string | string[] }>();
  const incomingState = normalizedParam(params.state);
  const invalidFromGate = normalizedParam(params.invalid) === '1';
  const [localLog, setLocalLog] = useState<FeedingLog>(emptyFeedingLog);
  const [sharedLog, setSharedLog] = useState<FeedingLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(BABY_FEEDING_STORAGE_KEY)
      .then(async (stored) => {
        if (!active) return;
        const current = deserializeFeedingLog(stored);
        setLocalLog(current);

        if (!incomingState) return;
        const shared = decodeSharedFeedingLog(incomingState);
        if (!shared) {
          setMessage('This shared link is invalid or uses an unsupported snapshot version.');
          return;
        }

        if (current.entries.length === 0 || feedingLogsEqual(current, shared)) {
          await AsyncStorage.setItem(BABY_FEEDING_STORAGE_KEY, JSON.stringify(shared));
          if (active) router.replace('/');
          return;
        }

        setSharedLog(shared);
      })
      .catch(() => {
        if (active) setMessage('The local feeding log could not be read.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [incomingState, router]);

  const shareUrl = useMemo(() => buildSharedFeedingUrl(localLog), [localLog]);

  const shareSnapshot = async () => {
    try {
      await Share.share({
        title: 'Baby Feeding snapshot',
        message: `Baby Feeding snapshot\n${shareUrl}`,
        url: shareUrl,
      });
      setMessage('The share sheet contains the complete current snapshot.');
    } catch {
      setMessage('The share sheet is unavailable here. Select and copy the link below instead.');
    }
  };

  const importSharedSnapshot = async () => {
    if (!sharedLog) return;
    await AsyncStorage.setItem(BABY_FEEDING_STORAGE_KEY, JSON.stringify(sharedLog));
    router.replace('/');
  };

  const keepLocalSnapshot = () => {
    router.replace('/');
  };

  const invalid = invalidFromGate || (!loading && Boolean(incomingState) && !sharedLog && Boolean(message));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>SHARE FEEDING LOG</Text>
        <Text style={styles.heading}>
          {incomingState ? 'Shared feeding state received.' : 'Share the current feeding state.'}
        </Text>
        <Text style={styles.subheading}>
          The snapshot contains the full feeding, pumping, bottle-use, cleaning, and sterilization log.
        </Text>

        {loading ? <Text style={styles.statusText}>Reading the local log…</Text> : null}

        {invalid ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Cannot open this snapshot</Text>
            <Text style={styles.noticeText}>
              The link is malformed or was created by an unsupported snapshot format. Your local log was
              not changed.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>Back to my log</Text>
            </Pressable>
          </View>
        ) : sharedLog ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Choose which state to keep</Text>
            <Text style={styles.noticeText}>
              This device already has feeding records, so the shared snapshot was not imported
              automatically.
            </Text>

            <View style={styles.comparisonRow}>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>This device</Text>
                <Text style={styles.comparisonValue}>{localLog.entries.length} records</Text>
                <Text style={styles.comparisonMeta}>Latest: {formatSnapshotTime(localLog)}</Text>
              </View>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>Shared link</Text>
                <Text style={styles.comparisonValue}>{sharedLog.entries.length} records</Text>
                <Text style={styles.comparisonMeta}>Latest: {formatSnapshotTime(sharedLog)}</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={importSharedSnapshot}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Replace with shared state</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={keepLocalSnapshot}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>Keep my local state</Text>
            </Pressable>
          </View>
        ) : !loading && !incomingState ? (
          <>
            <View style={styles.snapshotSummary}>
              <Text style={styles.snapshotLabel}>Current snapshot</Text>
              <Text style={styles.snapshotValue}>{localLog.entries.length} records</Text>
              <Text style={styles.snapshotMeta}>Latest: {formatSnapshotTime(localLog)}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={shareSnapshot}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Share snapshot link</Text>
            </Pressable>

            <Text selectable style={styles.shareUrl}>
              {shareUrl}
            </Text>

            {message ? <Text style={styles.statusText}>{message}</Text> : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
          </>
        ) : null}

        <View style={styles.privacyNotice}>
          <Text style={styles.privacyTitle}>Link privacy</Text>
          <Text style={styles.privacyText}>
            The records are encoded in the URL, not encrypted. Anyone who receives the link can read the
            snapshot, and the URL may remain in browser history or messaging history. Sharing creates a
            point-in-time copy; later changes do not sync automatically.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f2ee' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  eyebrow: { color: '#78685f', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: {
    color: '#332c29',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 37,
    letterSpacing: -0.9,
    marginTop: 8,
  },
  subheading: { color: '#776d68', fontSize: 14, lineHeight: 21, marginTop: 10 },
  notice: {
    backgroundColor: '#fffdfb',
    borderColor: '#e2d8d2',
    borderWidth: 1,
    borderRadius: 20,
    marginTop: 24,
    padding: 18,
  },
  noticeTitle: { color: '#3b322e', fontSize: 18, fontWeight: '800' },
  noticeText: { color: '#776d68', fontSize: 13, lineHeight: 20, marginTop: 7 },
  comparisonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  comparisonItem: {
    flexGrow: 1,
    flexBasis: 220,
    borderTopColor: '#ded4ce',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  comparisonLabel: {
    color: '#83766f',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  comparisonValue: { color: '#3b322e', fontSize: 17, fontWeight: '800', marginTop: 4 },
  comparisonMeta: { color: '#83766f', fontSize: 12, marginTop: 3 },
  snapshotSummary: {
    borderTopColor: '#ded4ce',
    borderTopWidth: 1,
    borderBottomColor: '#ded4ce',
    borderBottomWidth: 1,
    marginTop: 24,
    paddingVertical: 16,
  },
  snapshotLabel: {
    color: '#83766f',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  snapshotValue: { color: '#3b322e', fontSize: 19, fontWeight: '800', marginTop: 4 },
  snapshotMeta: { color: '#83766f', fontSize: 12, marginTop: 3 },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3f5b4d',
    borderRadius: 14,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#bcb0aa',
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: { color: '#544943', fontSize: 13, fontWeight: '800' },
  shareUrl: {
    color: '#635954',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 14,
    paddingVertical: 10,
  },
  statusText: { color: '#776d68', fontSize: 12, lineHeight: 18, marginTop: 14 },
  privacyNotice: {
    borderTopColor: '#ded4ce',
    borderTopWidth: 1,
    marginTop: 26,
    paddingTop: 18,
  },
  privacyTitle: { color: '#544943', fontSize: 13, fontWeight: '800' },
  privacyText: { color: '#83766f', fontSize: 12, lineHeight: 18, marginTop: 5 },
  pressed: { opacity: 0.66 },
});
