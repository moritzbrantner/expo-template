import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deserializeFeedingLog, emptyFeedingLog } from '../lib/feeding';
import { BABY_FEEDING_STORAGE_KEY } from '../lib/sharing';
import { summarizeFeedingLog, type DailyFeedingStats } from '../lib/stats';

type BarSegment = {
  key: string;
  value: number;
  style: ViewStyle;
};

type BarProps = {
  max: number;
  segments: BarSegment[];
};

function formatDay(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' }).format(
    new Date(timestamp),
  );
}

function Bar({ max, segments }: BarProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const remainder = Math.max(0, max - total);

  return (
    <View style={styles.barTrack}>
      {segments.map((segment) =>
        segment.value > 0 ? (
          <View key={segment.key} style={[styles.barSegment, segment.style, { flex: segment.value }]} />
        ) : null,
      )}
      {remainder > 0 ? <View style={{ flex: remainder }} /> : null}
      {total === 0 ? <View style={{ flex: max }} /> : null}
    </View>
  );
}

function IntakeRow({ day, max }: { day: DailyFeedingStats; max: number }) {
  const total = day.breastMilkMl + day.formulaMl;
  return (
    <View style={styles.chartRow}>
      <Text style={styles.dayLabel}>{formatDay(day.dayStart)}</Text>
      <Bar
        max={max}
        segments={[
          { key: 'breast', value: day.breastMilkMl, style: styles.breastBar },
          { key: 'formula', value: day.formulaMl, style: styles.formulaBar },
        ]}
      />
      <Text style={styles.valueLabel}>{total} ml</Text>
    </View>
  );
}

function PumpingRow({ day, max }: { day: DailyFeedingStats; max: number }) {
  return (
    <View style={styles.chartRow}>
      <Text style={styles.dayLabel}>{formatDay(day.dayStart)}</Text>
      <Bar
        max={max}
        segments={[{ key: 'pumped', value: day.pumpedMl, style: styles.pumpedBar }]}
      />
      <Text style={styles.valueLabel}>{day.pumpedMl} ml</Text>
    </View>
  );
}

function BreastfeedingRow({ day, max }: { day: DailyFeedingStats; max: number }) {
  return (
    <View style={styles.chartRow}>
      <Text style={styles.dayLabel}>{formatDay(day.dayStart)}</Text>
      <Bar
        max={max}
        segments={[
          {
            key: 'breastfeeding',
            value: day.breastfeedingSessions,
            style: styles.breastfeedingBar,
          },
        ]}
      />
      <Text style={styles.valueLabel}>{day.breastfeedingSessions}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const router = useRouter();
  const [log, setLog] = useState(emptyFeedingLog);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
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
  }, []);

  const summary = useMemo(() => summarizeFeedingLog(log, 7), [log]);
  const intakeMax = Math.max(
    1,
    ...summary.days.map((day) => day.breastMilkMl + day.formulaMl),
  );
  const pumpedMax = Math.max(1, ...summary.days.map((day) => day.pumpedMl));
  const breastfeedingMax = Math.max(
    1,
    ...summary.days.map((day) => day.breastfeedingSessions),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityLabel="Back to feeding log"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>BABY FEEDING</Text>
        <Text style={styles.heading}>Stats</Text>
        <Text style={styles.period}>Last 7 days</Text>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Measured intake</Text>
            <Text style={styles.summaryValue}>{summary.measuredIntakeMl} ml</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pumped</Text>
            <Text style={styles.summaryValue}>{summary.pumpedMl} ml</Text>
          </View>
          {summary.breastfeedingSessions > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Direct breastfeeding</Text>
              <Text style={styles.summaryValue}>{summary.breastfeedingSessions} sessions</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Measured intake</Text>
            <View style={styles.legend}>
              <View style={[styles.legendDot, styles.breastBar]} />
              <Text style={styles.legendText}>Breast milk</Text>
              <View style={[styles.legendDot, styles.formulaBar]} />
              <Text style={styles.legendText}>Formula</Text>
            </View>
          </View>
          <View style={styles.chartRows}>
            {summary.days.map((day) => (
              <IntakeRow key={day.dayStart} day={day} max={intakeMax} />
            ))}
          </View>
        </View>

        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Pumping</Text>
          <View style={styles.chartRows}>
            {summary.days.map((day) => (
              <PumpingRow key={day.dayStart} day={day} max={pumpedMax} />
            ))}
          </View>
        </View>

        {summary.breastfeedingSessions > 0 ? (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Direct breastfeeding</Text>
            <Text style={styles.chartNote}>
              Counted as sessions because the app does not invent a milk volume.
            </Text>
            <View style={styles.chartRows}>
              {summary.days.map((day) => (
                <BreastfeedingRow key={day.dayStart} day={day} max={breastfeedingMax} />
              ))}
            </View>
          </View>
        ) : null}

        {!hydrated ? <Text style={styles.loadingText}>Loading records…</Text> : null}
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
  eyebrow: { color: '#78685f', fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginTop: 10 },
  heading: {
    color: '#332c29',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 39,
    letterSpacing: -1,
    marginTop: 8,
  },
  period: { color: '#776d68', fontSize: 14, marginTop: 6 },
  summary: {
    borderTopColor: '#ded4ce',
    borderTopWidth: 1,
    borderBottomColor: '#ded4ce',
    borderBottomWidth: 1,
    marginTop: 22,
    paddingVertical: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 7,
  },
  summaryLabel: { color: '#655a54', fontSize: 14, fontWeight: '700' },
  summaryValue: { color: '#332c29', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chartSection: { marginTop: 30 },
  chartHeader: { gap: 9 },
  sectionTitle: { color: '#3b322e', fontSize: 19, fontWeight: '800' },
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 999 },
  legendText: { color: '#776d68', fontSize: 11, marginRight: 8 },
  chartNote: { color: '#7c716b', fontSize: 12, lineHeight: 18, marginTop: 6 },
  chartRows: { gap: 10, marginTop: 14 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dayLabel: { width: 48, color: '#746963', fontSize: 11, fontWeight: '700' },
  barTrack: {
    flex: 1,
    minWidth: 0,
    height: 18,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: '#e9e0db',
  },
  barSegment: { height: '100%' },
  breastBar: { backgroundColor: '#684f5b' },
  formulaBar: { backgroundColor: '#c99591' },
  pumpedBar: { backgroundColor: '#6f8f79' },
  breastfeedingBar: { backgroundColor: '#9a7b5a' },
  valueLabel: {
    width: 58,
    color: '#544943',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  loadingText: { color: '#928780', fontSize: 12, marginTop: 24 },
  pressed: { opacity: 0.66 },
});
