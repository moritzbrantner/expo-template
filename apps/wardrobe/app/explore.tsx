import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { exploreWardrobe, type WardrobeCluster, type WardrobeRedundancyGroup } from '../lib/explore';
import { deserializeWardrobeItems, type WardrobeItem } from '../lib/wardrobe';

const STORAGE_KEY = '@expo-template/wardrobe/items-v1';

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

function names(items: readonly WardrobeItem[]) {
  return items.map((item) => item.name).join(' · ');
}

function GroupCard({ group, label }: { group: WardrobeCluster | WardrobeRedundancyGroup; label: string }) {
  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <View style={styles.groupCopy}>
          <Text style={styles.groupLabel}>{label}</Text>
          <Text style={styles.groupTitle}>{group.representative.name}</Text>
        </View>
        <Text style={styles.score}>{percentage(group.meanSimilarity)}</Text>
      </View>
      <Text style={styles.groupNames}>{names(group.items)}</Text>
      <Text style={styles.groupMeta}>{group.items.length} pieces</Text>
    </View>
  );
}

export default function WardrobeExplore() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setStorageMessage(null);

      void AsyncStorage.getItem(STORAGE_KEY)
        .then((stored) => {
          if (active) {
            setItems(deserializeWardrobeItems(stored));
          }
        })
        .catch(() => {
          if (active) {
            setItems([]);
            setStorageMessage('The local wardrobe could not be read.');
          }
        })
        .finally(() => {
          if (active) {
            setLoaded(true);
          }
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const exploration = useMemo(() => exploreWardrobe(items), [items]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>WARDROBE · EXPLORE</Text>
        <Text style={styles.heading}>See the shape of what you own.</Text>
        <Text style={styles.subtitle}>
          These diagnostics use the same deterministic structured similarity as the catalog. Photos are not semantic input yet.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{items.length}</Text>
            <Text style={styles.statLabel}>Pieces</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{exploration.clusters.length}</Text>
            <Text style={styles.statLabel}>Style groups</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{exploration.outliers.length}</Text>
            <Text style={styles.statLabel}>Isolated</Text>
          </View>
        </View>

        {storageMessage ? <Text style={styles.warning}>{storageMessage}</Text> : null}

        {!loaded ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Reading your wardrobe…</Text>
          </View>
        ) : items.length < 2 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Add at least two pieces.</Text>
            <Text style={styles.emptyBody}>
              Exploration becomes useful once there is enough local evidence to compare items.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Style groups</Text>
              <Text style={styles.sectionIntro}>
                Connected groups whose pairwise neighborhoods cross the similarity threshold. A representative is chosen deterministically from the group.
              </Text>
              {exploration.clusters.length > 0 ? (
                <View style={styles.list}>
                  {exploration.clusters.map((cluster, index) => (
                    <GroupCard key={cluster.id} group={cluster} label={`Group ${index + 1}`} />
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyLine}>No strong style groups yet.</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Potential overlap</Text>
              <Text style={styles.sectionIntro}>
                Near-duplicate groups require both a high score and enough rich comparable evidence. Matching only category and color is deliberately not enough.
              </Text>
              {exploration.redundancyGroups.length > 0 ? (
                <View style={styles.list}>
                  {exploration.redundancyGroups.map((group, index) => (
                    <GroupCard key={group.id} group={group} label={`Overlap ${index + 1}`} />
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyLine}>No richly evidenced overlap detected.</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Isolated pieces</Text>
              <Text style={styles.sectionIntro}>
                Pieces whose strongest semantic neighbor is still weak. Isolation can be useful; this is a diagnostic, not a recommendation to buy anything.
              </Text>
              {exploration.outliers.length > 0 ? (
                <View style={styles.list}>
                  {exploration.outliers.map((outlier) => (
                    <View key={outlier.item.id} style={styles.outlierCard}>
                      <Text style={styles.outlierName}>{outlier.item.name}</Text>
                      <Text style={styles.outlierScore}>
                        strongest match {percentage(outlier.strongestSimilarity)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyLine}>Every piece has at least one meaningful neighbor.</Text>
              )}
            </View>
          </>
        )}

        <Text style={styles.footer}>
          Exploration is local and deterministic. It describes your existing wardrobe; it does not generate shopping prompts.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f2ec' },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 56,
  },
  eyebrow: { color: '#667067', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heading: {
    color: '#202922',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.1,
    marginTop: 7,
  },
  subtitle: { color: '#59615b', fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 600 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 26 },
  statCard: {
    flexGrow: 1,
    minWidth: 112,
    backgroundColor: '#faf9f5',
    borderColor: '#dcddd7',
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
  },
  statValue: { color: '#294333', fontSize: 24, fontWeight: '800' },
  statLabel: { color: '#717771', fontSize: 12, marginTop: 3 },
  warning: { color: '#8b4f35', fontSize: 13, marginTop: 16 },
  section: { marginTop: 28 },
  sectionTitle: { color: '#263128', fontSize: 21, fontWeight: '800' },
  sectionIntro: { color: '#687069', fontSize: 13, lineHeight: 20, marginTop: 6, maxWidth: 650 },
  list: { gap: 10, marginTop: 13 },
  groupCard: {
    backgroundColor: '#faf9f5',
    borderColor: '#d8dad4',
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
  },
  groupHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  groupCopy: { flex: 1 },
  groupLabel: { color: '#708078', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  groupTitle: { color: '#273129', fontSize: 17, fontWeight: '800', marginTop: 4 },
  score: { color: '#294333', fontSize: 18, fontWeight: '800' },
  groupNames: { color: '#59635c', fontSize: 13, lineHeight: 19, marginTop: 10 },
  groupMeta: { color: '#818681', fontSize: 11, marginTop: 7 },
  outlierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#faf9f5',
    borderRadius: 15,
    padding: 13,
  },
  outlierName: { flex: 1, color: '#273129', fontSize: 14, fontWeight: '800' },
  outlierScore: { color: '#707770', fontSize: 11 },
  emptyCard: {
    backgroundColor: '#faf9f5',
    borderColor: '#dcddd7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    marginTop: 24,
  },
  emptyTitle: { color: '#263028', fontSize: 18, fontWeight: '800' },
  emptyBody: { color: '#687069', fontSize: 14, lineHeight: 21, marginTop: 7 },
  emptyLine: { color: '#7a817a', fontSize: 13, marginTop: 12 },
  footer: { color: '#858a85', fontSize: 11, lineHeight: 17, marginTop: 32 },
});
