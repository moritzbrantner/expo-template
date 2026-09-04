import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { rankRelatedItems, type RelatedWardrobeItem } from '../lib/semantic';
import {
  createWardrobeItem,
  deserializeWardrobeItems,
  filterWardrobeItems,
  parseTags,
  WARDROBE_CATEGORIES,
  type WardrobeCategory,
  type WardrobeFilterCategory,
  type WardrobeItem,
} from '../lib/wardrobe';

const STORAGE_KEY = '@expo-template/wardrobe/items-v1';

const CATEGORY_LABELS: Record<WardrobeCategory, string> = {
  tops: 'Tops',
  bottoms: 'Bottoms',
  outerwear: 'Outerwear',
  'one-piece': 'One-piece',
  footwear: 'Footwear',
  accessories: 'Accessories',
};

const COLORS = [
  'black',
  'white',
  'grey',
  'navy',
  'blue',
  'brown',
  'beige',
  'green',
  'red',
  'pink',
  'purple',
  'yellow',
] as const;

const COLOR_SWATCHES: Record<(typeof COLORS)[number], string> = {
  black: '#222222',
  white: '#f4f2eb',
  grey: '#8b918c',
  navy: '#263b55',
  blue: '#557fa8',
  brown: '#765744',
  beige: '#c8b89c',
  green: '#607a62',
  red: '#a65652',
  pink: '#c58c9b',
  purple: '#75668c',
  yellow: '#d6b954',
};

function itemId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

function ColorDot({ color, size = 22 }: { color: string; size?: number }) {
  const swatch = COLOR_SWATCHES[color as keyof typeof COLOR_SWATCHES] ?? '#c9cbc7';
  return (
    <View
      accessibilityLabel={`${color} color`}
      style={[
        styles.colorDot,
        { backgroundColor: swatch, width: size, height: size, borderRadius: size / 2 },
      ]}
    />
  );
}

function ItemCard({ item, onPress }: { item: WardrobeItem; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.itemCard, pressed && styles.pressed]}>
      <ColorDot color={item.color} size={34} />
      <View style={styles.itemCardBody}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemMeta}>
          {CATEGORY_LABELS[item.category]} · {item.color}
        </Text>
        {item.tags.length > 0 ? (
          <Text style={styles.itemTags} numberOfLines={1}>
            {item.tags.map((tag) => `#${tag}`).join('  ')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function RelatedCard({ candidate }: { candidate: RelatedWardrobeItem }) {
  const { item, similarity } = candidate;
  return (
    <View style={styles.relatedCard}>
      <View style={styles.relatedHeader}>
        <View style={styles.relatedIdentity}>
          <ColorDot color={item.color} />
          <View style={styles.relatedCopy}>
            <Text style={styles.relatedName}>{item.name}</Text>
            <Text style={styles.relatedMeta}>{CATEGORY_LABELS[item.category]}</Text>
          </View>
        </View>
        <Text style={styles.similarityScore}>{percentage(similarity.total)}</Text>
      </View>
      <Text style={styles.breakdown}>
        category {percentage(similarity.category)} · color {percentage(similarity.color)} · tags{' '}
        {percentage(similarity.tags)} · name {percentage(similarity.name)}
      </Text>
    </View>
  );
}

export default function WardrobeApp() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<WardrobeFilterCategory>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WardrobeCategory>('tops');
  const [color, setColor] = useState<(typeof COLORS)[number]>('navy');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active) {
          setItems(deserializeWardrobeItems(stored));
        }
      })
      .catch(() => {
        // Local storage is a convenience boundary; a damaged cache must not block the app.
      })
      .finally(() => {
        if (active) {
          setHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, 150);

    return () => clearTimeout(timer);
  }, [hydrated, items]);

  const visibleItems = useMemo(
    () => filterWardrobeItems(items, query, filterCategory),
    [filterCategory, items, query],
  );
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const related = useMemo(
    () => (selectedId ? rankRelatedItems(items, selectedId, 3) : []),
    [items, selectedId],
  );
  const categoryCount = new Set(items.map((item) => item.category)).size;

  const resetDraft = () => {
    setName('');
    setCategory('tops');
    setColor('navy');
    setTags('');
    setNotes('');
  };

  const addItem = () => {
    if (!name.trim()) {
      return;
    }

    const next = createWardrobeItem(
      { name, category, color, tags: parseTags(tags), notes },
      itemId(),
    );
    setItems((current) => [next, ...current]);
    setSelectedId(next.id);
    setAdding(false);
    resetDraft();
  };

  const deleteSelected = () => {
    if (!selectedId) {
      return;
    }
    setItems((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>WARDROBE</Text>
              <Text style={styles.heading}>Know what you own.</Text>
              <Text style={styles.subtitle}>
                Keep a calm catalog of your clothes and see which pieces are meaningfully close.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={adding ? 'Close add clothing form' : 'Add clothing item'}
              onPress={() => setAdding((current) => !current)}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>{adding ? 'Close' : '+ Add'}</Text>
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{items.length}</Text>
              <Text style={styles.statLabel}>Pieces</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{categoryCount}</Text>
              <Text style={styles.statLabel}>Categories</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{items.reduce((sum, item) => sum + item.tags.length, 0)}</Text>
              <Text style={styles.statLabel}>Tag signals</Text>
            </View>
          </View>

          {adding ? (
            <View style={styles.formCard}>
              <Text style={styles.sectionHeading}>Add a piece</Text>
              <Text style={styles.formHint}>
                A few stable attributes are enough for useful local similarity. Photos can come later.
              </Text>

              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                accessibilityLabel="Clothing name"
                autoCapitalize="words"
                onChangeText={setName}
                placeholder="Navy linen shirt"
                placeholderTextColor="#7b817b"
                style={styles.input}
                value={name}
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.chipRow}>
                {WARDROBE_CATEGORIES.map((option) => {
                  const active = category === option;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setCategory(option)}
                      style={({ pressed }) => [
                        styles.chip,
                        active && styles.chipActive,
                        pressed && styles.pressed,
                      ]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {CATEGORY_LABELS[option]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Color</Text>
              <View style={styles.colorRow}>
                {COLORS.map((option) => {
                  const active = color === option;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityLabel={`${option} color`}
                      accessibilityState={{ selected: active }}
                      onPress={() => setColor(option)}
                      style={({ pressed }) => [
                        styles.colorChoice,
                        active && styles.colorChoiceActive,
                        pressed && styles.pressed,
                      ]}>
                      <ColorDot color={option} />
                      <Text style={styles.colorChoiceText}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Tags</Text>
              <TextInput
                accessibilityLabel="Clothing tags"
                autoCapitalize="none"
                onChangeText={setTags}
                placeholder="linen, summer, smart casual"
                placeholderTextColor="#7b817b"
                style={styles.input}
                value={tags}
              />

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                accessibilityLabel="Clothing notes"
                multiline
                onChangeText={setNotes}
                placeholder="Fit, fabric, occasions, care…"
                placeholderTextColor="#7b817b"
                style={[styles.input, styles.notesInput]}
                textAlignVertical="top"
                value={notes}
              />

              <Pressable
                accessibilityRole="button"
                disabled={!name.trim()}
                onPress={addItem}
                style={({ pressed }) => [
                  styles.saveButton,
                  !name.trim() && styles.saveButtonDisabled,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.saveButtonText}>Save piece</Text>
              </Pressable>
            </View>
          ) : null}

          {selectedItem ? (
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View style={styles.detailIdentity}>
                  <ColorDot color={selectedItem.color} size={44} />
                  <View style={styles.detailCopy}>
                    <Text style={styles.detailName}>{selectedItem.name}</Text>
                    <Text style={styles.detailMeta}>
                      {CATEGORY_LABELS[selectedItem.category]} · {selectedItem.color}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close clothing details"
                  onPress={() => setSelectedId(null)}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
              </View>

              {selectedItem.tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {selectedItem.tags.map((tag) => (
                    <Text key={tag} style={styles.tagBadge}>#{tag}</Text>
                  ))}
                </View>
              ) : null}
              {selectedItem.notes ? <Text style={styles.notesText}>{selectedItem.notes}</Text> : null}

              <Text style={styles.relatedTitle}>Closest pieces</Text>
              <Text style={styles.relatedIntro}>
                The score is local and inspectable: category, color, tags, and name each contribute a fixed share.
              </Text>
              {related.length > 0 ? (
                <View style={styles.relatedList}>
                  {related.map((candidate) => (
                    <RelatedCard key={candidate.item.id} candidate={candidate} />
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyRelated}>Add another related piece to compare it here.</Text>
              )}

              <Pressable
                accessibilityRole="button"
                onPress={deleteSelected}
                style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                <Text style={styles.deleteButtonText}>Remove piece</Text>
              </Pressable>
            </View>
          ) : null}

          <TextInput
            accessibilityLabel="Search wardrobe"
            onChangeText={setQuery}
            placeholder="Search name, color, tags, or notes"
            placeholderTextColor="#7b817b"
            style={styles.searchInput}
            value={query}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}>
            {(['all', ...WARDROBE_CATEGORIES] as WardrobeFilterCategory[]).map((option) => {
              const active = filterCategory === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilterCategory(option)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    active && styles.filterChipActive,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {option === 'all' ? 'All' : CATEGORY_LABELS[option]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.list}>
            {visibleItems.length > 0 ? (
              visibleItems.map((item) => (
                <ItemCard key={item.id} item={item} onPress={() => setSelectedId(item.id)} />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {items.length === 0 ? 'Your wardrobe is empty.' : 'No pieces match.'}
                </Text>
                <Text style={styles.emptyBody}>
                  {items.length === 0
                    ? 'Add a few pieces with simple attributes. The catalog stays on this device.'
                    : 'Try another search term or category.'}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.footer}>
            Wardrobe data stays on this device. Similarity is deterministic clothing policy, not a shopping feed or remote model.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f4f2ec' },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 56,
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  heroCopy: { flex: 1 },
  eyebrow: { color: '#667067', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heading: {
    color: '#202922',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.2,
    marginTop: 6,
  },
  subtitle: { color: '#59615b', fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 560 },
  primaryButton: {
    backgroundColor: '#294333',
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 17,
    paddingVertical: 11,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.68 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 28 },
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
  formCard: {
    backgroundColor: '#faf9f5',
    borderColor: '#d8dad4',
    borderWidth: 1,
    borderRadius: 22,
    marginTop: 22,
    padding: 18,
  },
  sectionHeading: { color: '#263128', fontSize: 21, fontWeight: '800' },
  formHint: { color: '#687069', fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 2 },
  fieldLabel: { color: '#424c44', fontSize: 13, fontWeight: '800', marginTop: 17, marginBottom: 7 },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#d5d8d1',
    borderWidth: 1,
    borderRadius: 14,
    color: '#202922',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  notesInput: { minHeight: 88 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#ffffff',
    borderColor: '#cfd3cc',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: '#294333', borderColor: '#294333' },
  chipText: { color: '#535d55', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#ffffff' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#ffffff',
    borderColor: '#d2d5cf',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  colorChoiceActive: { borderColor: '#294333', borderWidth: 2, paddingHorizontal: 8, paddingVertical: 6 },
  colorChoiceText: { color: '#505852', fontSize: 12, textTransform: 'capitalize' },
  colorDot: { borderColor: '#c4c7c1', borderWidth: 1 },
  saveButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#294333',
    borderRadius: 999,
    marginTop: 20,
    paddingHorizontal: 17,
    paddingVertical: 11,
  },
  saveButtonDisabled: { opacity: 0.38 },
  saveButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  detailCard: {
    backgroundColor: '#eef2eb',
    borderColor: '#cbd4ca',
    borderWidth: 1,
    borderRadius: 22,
    marginTop: 22,
    padding: 18,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  detailIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailCopy: { flex: 1 },
  detailName: { color: '#233027', fontSize: 22, fontWeight: '800' },
  detailMeta: { color: '#667068', fontSize: 13, marginTop: 3, textTransform: 'capitalize' },
  closeButton: { paddingHorizontal: 8, paddingVertical: 5 },
  closeButtonText: { color: '#526056', fontSize: 13, fontWeight: '800' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 16 },
  tagBadge: {
    color: '#3d5845',
    backgroundColor: '#dce7db',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '700',
  },
  notesText: { color: '#4f5a52', fontSize: 14, lineHeight: 21, marginTop: 14 },
  relatedTitle: { color: '#263128', fontSize: 17, fontWeight: '800', marginTop: 22 },
  relatedIntro: { color: '#687069', fontSize: 13, lineHeight: 20, marginTop: 5 },
  relatedList: { gap: 9, marginTop: 12 },
  relatedCard: { backgroundColor: '#ffffff', borderRadius: 15, padding: 12 },
  relatedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  relatedIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  relatedCopy: { flex: 1 },
  relatedName: { color: '#263128', fontSize: 14, fontWeight: '800' },
  relatedMeta: { color: '#747b75', fontSize: 11, marginTop: 2 },
  similarityScore: { color: '#294333', fontSize: 17, fontWeight: '800' },
  breakdown: { color: '#777e78', fontSize: 10, lineHeight: 15, marginTop: 8 },
  emptyRelated: { color: '#747b75', fontSize: 13, marginTop: 11 },
  deleteButton: { alignSelf: 'flex-start', marginTop: 18, paddingVertical: 7 },
  deleteButtonText: { color: '#8b3f3f', fontSize: 13, fontWeight: '800' },
  searchInput: {
    backgroundColor: '#ffffff',
    borderColor: '#d8dad4',
    borderWidth: 1,
    borderRadius: 15,
    color: '#202922',
    fontSize: 15,
    marginTop: 22,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  filterRow: { gap: 8, paddingVertical: 13 },
  filterChip: {
    backgroundColor: '#faf9f5',
    borderColor: '#d0d3cd',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: { backgroundColor: '#294333', borderColor: '#294333' },
  filterText: { color: '#59625b', fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#ffffff' },
  list: { gap: 10 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: '#faf9f5',
    borderColor: '#dcddd7',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  itemCardBody: { flex: 1 },
  itemName: { color: '#263028', fontSize: 17, fontWeight: '800' },
  itemMeta: { color: '#6d746e', fontSize: 12, marginTop: 3, textTransform: 'capitalize' },
  itemTags: { color: '#526759', fontSize: 11, marginTop: 7 },
  emptyCard: {
    backgroundColor: '#faf9f5',
    borderColor: '#dcddd7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
  },
  emptyTitle: { color: '#263028', fontSize: 19, fontWeight: '800' },
  emptyBody: { color: '#687069', fontSize: 14, lineHeight: 21, marginTop: 7 },
  footer: { color: '#858a85', fontSize: 11, lineHeight: 17, marginTop: 24 },
});
