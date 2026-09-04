import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  WARDROBE_RELATIONS_STORAGE_KEY,
  canLayer,
  deserializeWardrobeRelations,
  hasWardrobeRelation,
  suggestOutfits,
  toggleWardrobeRelation,
  wardrobeCompatibility,
  type WardrobeRelation,
} from '../lib/compatibility';
import { deserializeWardrobeItems, type WardrobeItem } from '../lib/wardrobe';

const ITEMS_STORAGE_KEY = '@expo-template/wardrobe/items-v1';

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

function RelationCandidate({
  source,
  candidate,
  relations,
  onTogglePair,
  onToggleLayer,
}: {
  source: WardrobeItem;
  candidate: WardrobeItem;
  relations: readonly WardrobeRelation[];
  onTogglePair: () => void;
  onToggleLayer: () => void;
}) {
  const compatibility = wardrobeCompatibility(source, candidate, relations);
  const paired = hasWardrobeRelation(relations, 'pairs-with', source.id, candidate.id);
  const layered = canLayer(source, candidate)
    ? hasWardrobeRelation(relations, 'layered-with', source.id, candidate.id)
    : false;

  return (
    <View style={styles.relationCard}>
      <View style={styles.relationHeader}>
        <View style={styles.relationCopy}>
          <Text style={styles.relationName}>{candidate.name}</Text>
          <Text style={styles.relationMeta}>{candidate.category}</Text>
        </View>
        <Text style={styles.compatibilityScore}>{percentage(compatibility.total)}</Text>
      </View>
      <Text style={styles.reasonText}>
        {compatibility.reasons.length > 0
          ? compatibility.reasons.join(' · ')
          : 'No strong shared context yet'}
      </Text>
      <View style={styles.relationActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: paired }}
          onPress={onTogglePair}
          style={({ pressed }) => [
            styles.relationButton,
            paired && styles.relationButtonActive,
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.relationButtonText, paired && styles.relationButtonTextActive]}>
            Pairs with
          </Text>
        </Pressable>
        {canLayer(source, candidate) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: layered }}
            onPress={onToggleLayer}
            style={({ pressed }) => [
              styles.relationButton,
              layered && styles.relationButtonActive,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.relationButtonText, layered && styles.relationButtonTextActive]}>
              Layers with
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function WardrobeOutfits() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [relations, setRelations] = useState<WardrobeRelation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setStorageMessage(null);

      void Promise.all([
        AsyncStorage.getItem(ITEMS_STORAGE_KEY),
        AsyncStorage.getItem(WARDROBE_RELATIONS_STORAGE_KEY),
      ])
        .then(([storedItems, storedRelations]) => {
          if (!active) return;
          const nextItems = deserializeWardrobeItems(storedItems);
          const nextRelations = deserializeWardrobeRelations(
            storedRelations,
            nextItems.map((item) => item.id),
          );
          setItems(nextItems);
          setRelations(nextRelations);
          setSelectedId((current) =>
            current && nextItems.some((item) => item.id === current)
              ? current
              : nextItems[0]?.id ?? null,
          );
        })
        .catch(() => {
          if (active) {
            setItems([]);
            setRelations([]);
            setSelectedId(null);
            setStorageMessage('The local wardrobe or compatibility relations could not be read.');
          }
        })
        .finally(() => {
          if (active) setLoaded(true);
        });

      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(WARDROBE_RELATIONS_STORAGE_KEY, JSON.stringify(relations));
    }, 150);
    return () => clearTimeout(timer);
  }, [loaded, relations]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const candidates = useMemo(() => {
    if (!selected) return [];
    return items
      .filter((item) => item.id !== selected.id)
      .map((item) => ({ item, compatibility: wardrobeCompatibility(selected, item, relations) }))
      .sort(
        (left, right) =>
          right.compatibility.total - left.compatibility.total ||
          left.item.name.localeCompare(right.item.name),
      );
  }, [items, relations, selected]);
  const outfits = useMemo(
    () => (selected ? suggestOutfits(items, selected.id, relations, 3) : []),
    [items, relations, selected],
  );

  const toggle = (kind: 'pairs-with' | 'layered-with', candidateId: string) => {
    if (!selected) return;
    setRelations((current) =>
      toggleWardrobeRelation(current, kind, selected.id, candidateId),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>WARDROBE · OUTFITS</Text>
        <Text style={styles.heading}>Compatibility is not similarity.</Text>
        <Text style={styles.subtitle}>
          Mark pieces that actually work together, then build deterministic outfit suggestions from complementary categories and shared context.
        </Text>

        {storageMessage ? <Text style={styles.warning}>{storageMessage}</Text> : null}

        {!loaded ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Reading compatibility…</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your wardrobe is empty.</Text>
            <Text style={styles.emptyBody}>Add pieces in the Wardrobe tab before building outfits.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Build around</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerRow}>
              {items.map((item) => {
                const active = item.id === selectedId;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectedId(item.id)}
                    style={({ pressed }) => [
                      styles.pickerChip,
                      active && styles.pickerChipActive,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.pickerText, active && styles.pickerTextActive]}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selected ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Suggested outfits</Text>
                  <Text style={styles.sectionIntro}>
                    Suggestions keep the selected piece, fill complementary category slots, and rank the resulting set by pairwise compatibility.
                  </Text>
                  {outfits.length > 0 ? (
                    <View style={styles.list}>
                      {outfits.map((outfit, index) => (
                        <View key={outfit.id} style={styles.outfitCard}>
                          <View style={styles.outfitHeader}>
                            <Text style={styles.outfitTitle}>Outfit {index + 1}</Text>
                            <Text style={styles.compatibilityScore}>{percentage(outfit.score)}</Text>
                          </View>
                          <Text style={styles.outfitItems}>
                            {outfit.items.map((item) => item.name).join(' · ')}
                          </Text>
                          <Text style={styles.reasonText}>
                            {outfit.reasons.length > 0
                              ? outfit.reasons.join(' · ')
                              : 'category compatibility'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyLine}>
                      Not enough complementary pieces yet for a complete suggestion.
                    </Text>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Explicit relationships</Text>
                  <Text style={styles.sectionIntro}>
                    “Pairs with” is a compatibility relation. “Layers with” is only available for outerwear with a top or one-piece. Neither changes semantic similarity.
                  </Text>
                  {candidates.length > 0 ? (
                    <View style={styles.list}>
                      {candidates.map(({ item }) => (
                        <RelationCandidate
                          key={item.id}
                          source={selected}
                          candidate={item}
                          relations={relations}
                          onTogglePair={() => toggle('pairs-with', item.id)}
                          onToggleLayer={() => toggle('layered-with', item.id)}
                        />
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyLine}>Add another piece to define relationships.</Text>
                  )}
                </View>
              </>
            ) : null}
          </>
        )}

        <Text style={styles.footer}>
          Compatibility relations and outfit suggestions stay on this device. They describe pieces you already own and do not create a shopping feed.
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
  heading: { color: '#202922', fontSize: 34, fontWeight: '800', letterSpacing: -1.1, marginTop: 7 },
  subtitle: { color: '#59615b', fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 620 },
  warning: { color: '#8b4f35', fontSize: 13, marginTop: 16 },
  section: { marginTop: 28 },
  sectionTitle: { color: '#263128', fontSize: 20, fontWeight: '800', marginTop: 24 },
  sectionIntro: { color: '#687069', fontSize: 13, lineHeight: 20, marginTop: 6, maxWidth: 650 },
  pickerRow: { gap: 8, paddingTop: 12, paddingBottom: 2 },
  pickerChip: {
    backgroundColor: '#faf9f5',
    borderColor: '#d0d3cd',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  pickerChipActive: { backgroundColor: '#294333', borderColor: '#294333' },
  pickerText: { color: '#59625b', fontSize: 12, fontWeight: '700' },
  pickerTextActive: { color: '#ffffff' },
  list: { gap: 10, marginTop: 13 },
  outfitCard: { backgroundColor: '#eef2eb', borderRadius: 18, padding: 15 },
  outfitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  outfitTitle: { color: '#263128', fontSize: 16, fontWeight: '800' },
  outfitItems: { color: '#445047', fontSize: 14, lineHeight: 21, marginTop: 9 },
  compatibilityScore: { color: '#294333', fontSize: 17, fontWeight: '800' },
  reasonText: { color: '#737a74', fontSize: 11, lineHeight: 17, marginTop: 8 },
  relationCard: {
    backgroundColor: '#faf9f5',
    borderColor: '#dcddd7',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  relationHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  relationCopy: { flex: 1 },
  relationName: { color: '#263128', fontSize: 15, fontWeight: '800' },
  relationMeta: { color: '#747b75', fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  relationActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  relationButton: {
    borderColor: '#cfd3cc',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  relationButtonActive: { backgroundColor: '#294333', borderColor: '#294333' },
  relationButtonText: { color: '#59625b', fontSize: 12, fontWeight: '800' },
  relationButtonTextActive: { color: '#ffffff' },
  pressed: { opacity: 0.68 },
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
