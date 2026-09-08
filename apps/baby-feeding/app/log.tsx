import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deserializeFeedingLog,
  emptyFeedingLog,
  formatDateInput,
  removeEntry,
  type FeedingEntry,
} from '../lib/feeding';
import { BABY_FEEDING_STORAGE_KEY } from '../lib/sharing';

function formatClock(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(timestamp),
  );
}

function formatDay(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function milkLabel(milkType: 'breast-milk' | 'formula') {
  return milkType === 'breast-milk' ? 'Breast milk' : 'Formula';
}

function entryTitle(entry: FeedingEntry) {
  if (entry.kind === 'breastfeeding') return 'Breastfeeding';
  if (entry.kind === 'feed') return milkLabel(entry.milkType);
  if (entry.kind === 'pumping') return 'Pumping';
  if (entry.kind === 'bottle-clean') return 'Bottles cleaned';
  return 'Bottles sterilized';
}

function entryMeta(entry: FeedingEntry) {
  if (entry.kind === 'breastfeeding') return 'Direct breastfeeding';
  if (entry.kind === 'feed') {
    return `${entry.amountMl} ml${entry.bottleUsed ? ' · bottle used' : ''}`;
  }
  if (entry.kind === 'pumping') return `${entry.amountMl} ml`;
  if (entry.kind === 'bottle-clean') return 'Dirty-bottle count reset';
  return 'Sterilization recorded';
}

function entryDeleteLabel(entry: FeedingEntry) {
  if (entry.kind === 'breastfeeding') return 'breastfeeding';
  if (entry.kind === 'feed') return 'bottle feed';
  if (entry.kind === 'pumping') return 'pumping';
  if (entry.kind === 'bottle-clean') return 'bottle cleaning';
  return 'bottle sterilization';
}

export default function FeedingLogScreen() {
  const router = useRouter();
  const [log, setLog] = useState(emptyFeedingLog);
  const [hydrated, setHydrated] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setHydrated(false);
      void AsyncStorage.getItem(BABY_FEEDING_STORAGE_KEY)
        .then((stored) => {
          if (active) setLog(deserializeFeedingLog(stored));
        })
        .catch(() => {})
        .finally(() => {
          if (active) setHydrated(true);
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const groupedEntries = useMemo(() => {
    const groups: Array<{ key: string; label: string; entries: FeedingEntry[] }> = [];
    const newestFirst = [...log.entries].sort(
      (left, right) => right.occurredAt - left.occurredAt || right.id.localeCompare(left.id),
    );

    for (const entry of newestFirst) {
      const key = formatDateInput(entry.occurredAt);
      const current = groups.at(-1);
      if (current?.key === key) {
        current.entries.push(entry);
      } else {
        groups.push({ key, label: formatDay(entry.occurredAt), entries: [entry] });
      }
    }

    return groups;
  }, [log.entries]);

  const deleteEntry = (id: string) => {
    setLog((current) => {
      const next = removeEntry(current, id);
      void AsyncStorage.setItem(BABY_FEEDING_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityLabel="Back to recorder"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>BABY FEEDING</Text>
        <Text style={styles.heading}>Log</Text>
        <Text style={styles.intro}>Recorded feeding and care events, newest first.</Text>

        {!hydrated ? <Text style={styles.loadingText}>Loading records…</Text> : null}

        {hydrated && groupedEntries.length === 0 ? (
          <Text style={styles.emptyText}>Your feeding log will appear here.</Text>
        ) : null}

        {groupedEntries.map((group) => (
          <View key={group.key} style={styles.dayGroup}>
            <Text style={styles.dayHeading}>{group.label}</Text>
            {group.entries.map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <Text style={styles.entryTime}>{formatClock(entry.occurredAt)}</Text>
                <View style={styles.entryCopy}>
                  <Text style={styles.entryTitle}>{entryTitle(entry)}</Text>
                  <Text style={styles.entryMeta}>{entryMeta(entry)}</Text>
                </View>
                <Pressable
                  accessibilityLabel={`Delete ${entryDeleteLabel(entry)} record`}
                  accessibilityRole="button"
                  onPress={() => deleteEntry(entry.id)}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footer}>
          Records stay on this device unless you explicitly create a share link.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f2ee' },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
  },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12 },
  backText: { color: '#5f554f', fontSize: 14, fontWeight: '800' },
  eyebrow: {
    color: '#78685f',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 10,
  },
  heading: { color: '#332c29', fontSize: 34, fontWeight: '800', marginTop: 4 },
  intro: { color: '#776d68', fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 4 },
  loadingText: { color: '#8e837d', fontSize: 13, paddingVertical: 24 },
  dayGroup: { marginTop: 22 },
  dayHeading: {
    color: '#8a7d76',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomColor: '#ded4ce',
    borderBottomWidth: 1,
    paddingVertical: 13,
  },
  entryTime: {
    width: 64,
    color: '#3d3430',
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  entryCopy: { flex: 1 },
  entryTitle: { color: '#3d3430', fontSize: 14, fontWeight: '700' },
  entryMeta: { color: '#847973', fontSize: 12, marginTop: 2 },
  deleteButton: { paddingVertical: 7, paddingLeft: 8 },
  deleteText: { color: '#96534e', fontSize: 11, fontWeight: '700' },
  emptyText: {
    color: '#8e837d',
    borderBottomColor: '#ded4ce',
    borderBottomWidth: 1,
    paddingVertical: 24,
  },
  footer: { color: '#928780', fontSize: 12, lineHeight: 18, marginTop: 28 },
  pressed: { opacity: 0.66 },
});