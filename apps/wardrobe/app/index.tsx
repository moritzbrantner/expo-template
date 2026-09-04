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
  parseList,
  parseTags,
  updateWardrobeItem,
  WARDROBE_CATEGORIES,
  WARDROBE_FITS,
  WARDROBE_FORMALITY_LEVELS,
  WARDROBE_OCCASIONS,
  WARDROBE_SEASONS,
  type WardrobeCategory,
  type WardrobeFilterCategory,
  type WardrobeFit,
  type WardrobeFormality,
  type WardrobeItem,
  type WardrobeOccasion,
  type WardrobeSeason,
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

const SEASON_LABELS: Record<WardrobeSeason, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

const OCCASION_LABELS: Record<WardrobeOccasion, string> = {
  everyday: 'Everyday',
  work: 'Work',
  formal: 'Formal',
  sport: 'Sport',
  outdoor: 'Outdoor',
  home: 'Home',
  travel: 'Travel',
};

const FORMALITY_LABELS: Record<WardrobeFormality, string> = {
  casual: 'Casual',
  'smart-casual': 'Smart casual',
  business: 'Business',
  formal: 'Formal',
};

const FIT_LABELS: Record<WardrobeFit, string> = {
  slim: 'Slim',
  regular: 'Regular',
  relaxed: 'Relaxed',
  oversized: 'Oversized',
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

type WardrobeColor = (typeof COLORS)[number];

type ItemDraftState = {
  name: string;
  category: WardrobeCategory;
  color: string;
  materials: string;
  seasons: WardrobeSeason[];
  occasions: WardrobeOccasion[];
  formality: WardrobeFormality | null;
  fit: WardrobeFit | null;
  tags: string;
  notes: string;
};

const COLOR_SWATCHES: Record<WardrobeColor, string> = {
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

function emptyDraft(): ItemDraftState {
  return {
    name: '',
    category: 'tops',
    color: 'navy',
    materials: '',
    seasons: [],
    occasions: [],
    formality: null,
    fit: null,
    tags: '',
    notes: '',
  };
}

function draftFromItem(item: WardrobeItem): ItemDraftState {
  return {
    name: item.name,
    category: item.category,
    color: item.color,
    materials: item.materials.join(', '),
    seasons: [...item.seasons],
    occasions: [...item.occasions],
    formality: item.formality,
    fit: item.fit,
    tags: item.tags.join(', '),
    notes: item.notes,
  };
}

function toggleChoice<T extends string>(values: readonly T[], value: T) {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function ColorDot({ color, size = 22 }: { color: string; size?: number }) {
  const swatch = COLOR_SWATCHES[color as WardrobeColor] ?? '#c9cbc7';
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

function CategorySelector({
  value,
  onChange,
}: {
  value: WardrobeCategory;
  onChange: (category: WardrobeCategory) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {WARDROBE_CATEGORIES.map((option) => {
        const active = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option)}
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
  );
}

function ColorSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: WardrobeColor) => void;
}) {
  return (
    <View style={styles.colorRow}>
      {COLORS.map((option) => {
        const active = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={`${option} color`}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option)}
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
  );
}

function MultiChoice<T extends string>({
  options,
  labels,
  values,
  onChange,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  values: readonly T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = values.includes(option);
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(toggleChoice(values, option))}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {labels[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OptionalChoice<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <View style={styles.chipRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: value === null }}
        onPress={() => onChange(null)}
        style={({ pressed }) => [
          styles.chip,
          value === null && styles.chipActive,
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.chipText, value === null && styles.chipTextActive]}>Not set</Text>
      </Pressable>
      {options.map((option) => {
        const active = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {labels[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DraftFields({
  draft,
  onChange,
  labelPrefix,
}: {
  draft: ItemDraftState;
  onChange: (draft: ItemDraftState) => void;
  labelPrefix: string;
}) {
  const update = <K extends keyof ItemDraftState>(key: K, value: ItemDraftState[K]) => {
    onChange({ ...draft, [key]: value });
  };

  return (
    <>
      <Text style={styles.fieldLabel}>Name</Text>
      <TextInput
        accessibilityLabel={`${labelPrefix} name`}
        autoCapitalize="words"
        onChangeText={(value) => update('name', value)}
        placeholder="Navy linen shirt"
        placeholderTextColor="#7b817b"
        style={styles.input}
        value={draft.name}
      />

      <Text style={styles.fieldLabel}>Category</Text>
      <CategorySelector value={draft.category} onChange={(value) => update('category', value)} />

      <Text style={styles.fieldLabel}>Color</Text>
      <ColorSelector value={draft.color} onChange={(value) => update('color', value)} />

      <Text style={styles.fieldLabel}>Materials</Text>
      <TextInput
        accessibilityLabel={`${labelPrefix} materials`}
        autoCapitalize="none"
        onChangeText={(value) => update('materials', value)}
        placeholder="linen, cotton"
        placeholderTextColor="#7b817b"
        style={styles.input}
        value={draft.materials}
      />

      <Text style={styles.fieldLabel}>Seasons</Text>
      <MultiChoice
        options={WARDROBE_SEASONS}
        labels={SEASON_LABELS}
        values={draft.seasons}
        onChange={(value) => update('seasons', value)}
      />

      <Text style={styles.fieldLabel}>Occasions</Text>
      <MultiChoice
        options={WARDROBE_OCCASIONS}
        labels={OCCASION_LABELS}
        values={draft.occasions}
        onChange={(value) => update('occasions', value)}
      />

      <Text style={styles.fieldLabel}>Formality</Text>
      <OptionalChoice
        options={WARDROBE_FORMALITY_LEVELS}
        labels={FORMALITY_LABELS}
        value={draft.formality}
        onChange={(value) => update('formality', value)}
      />

      <Text style={styles.fieldLabel}>Fit</Text>
      <OptionalChoice
        options={WARDROBE_FITS}
        labels={FIT_LABELS}
        value={draft.fit}
        onChange={(value) => update('fit', value)}
      />

      <Text style={styles.fieldLabel}>Tags</Text>
      <TextInput
        accessibilityLabel={`${labelPrefix} tags`}
        autoCapitalize="none"
        onChangeText={(value) => update('tags', value)}
        placeholder="minimal, striped, favourite"
        placeholderTextColor="#7b817b"
        style={styles.input}
        value={draft.tags}
      />

      <Text style={styles.fieldLabel}>Notes</Text>
      <TextInput
        accessibilityLabel={`${labelPrefix} notes`}
        multiline
        onChangeText={(value) => update('notes', value)}
        placeholder="Care, fit observations, combinations…"
        placeholderTextColor="#7b817b"
        style={[styles.input, styles.notesInput]}
        textAlignVertical="top"
        value={draft.notes}
      />
    </>
  );
}

function attributeSummary(item: WardrobeItem) {
  return [
    item.materials[0],
    item.seasons[0] ? SEASON_LABELS[item.seasons[0]] : null,
    item.formality ? FORMALITY_LABELS[item.formality] : null,
    item.fit ? FIT_LABELS[item.fit] : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function ItemCard({ item, onPress }: { item: WardrobeItem; onPress: () => void }) {
  const attributes = attributeSummary(item);
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
        {attributes ? <Text style={styles.itemAttributes}>{attributes}</Text> : null}
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
  const signals = [
    ['category', similarity.category, similarity.available.category],
    ['color', similarity.color, similarity.available.color],
    ['material', similarity.materials, similarity.available.materials],
    ['season', similarity.seasons, similarity.available.seasons],
    ['occasion', similarity.occasions, similarity.available.occasions],
    ['formality', similarity.formality, similarity.available.formality],
    ['fit', similarity.fit, similarity.available.fit],
    ['tags', similarity.tags, similarity.available.tags],
    ['name', similarity.name, similarity.available.name],
  ] as const;
  const breakdown = signals
    .filter(([, , available]) => available)
    .map(([label, score]) => `${label} ${percentage(score)}`)
    .join(' · ');

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
      <Text style={styles.breakdown}>{breakdown}</Text>
    </View>
  );
}

export default function WardrobeApp() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<WardrobeFilterCategory>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ItemDraftState | null>(null);
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<ItemDraftState>(() => emptyDraft());

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
  const attributeSignalCount = items.reduce(
    (sum, item) =>
      sum +
      item.materials.length +
      item.seasons.length +
      item.occasions.length +
      item.tags.length +
      (item.formality ? 1 : 0) +
      (item.fit ? 1 : 0),
    0,
  );

  const openItem = (item: WardrobeItem) => {
    setSelectedId(item.id);
    setEditDraft(draftFromItem(item));
  };

  const closeItem = () => {
    setSelectedId(null);
    setEditDraft(null);
  };

  const addItem = () => {
    if (!newDraft.name.trim()) {
      return;
    }

    const next = createWardrobeItem(
      {
        name: newDraft.name,
        category: newDraft.category,
        color: newDraft.color,
        materials: parseList(newDraft.materials),
        seasons: newDraft.seasons,
        occasions: newDraft.occasions,
        formality: newDraft.formality,
        fit: newDraft.fit,
        tags: parseTags(newDraft.tags),
        notes: newDraft.notes,
      },
      itemId(),
    );
    setItems((current) => [next, ...current]);
    setSelectedId(next.id);
    setEditDraft(draftFromItem(next));
    setAdding(false);
    setNewDraft(emptyDraft());
  };

  const saveSelected = () => {
    if (!selectedItem || !editDraft || !editDraft.name.trim()) {
      return;
    }

    const next = updateWardrobeItem(selectedItem, {
      name: editDraft.name,
      category: editDraft.category,
      color: editDraft.color,
      materials: parseList(editDraft.materials),
      seasons: editDraft.seasons,
      occasions: editDraft.occasions,
      formality: editDraft.formality,
      fit: editDraft.fit,
      tags: parseTags(editDraft.tags),
      notes: editDraft.notes,
    });
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
    setEditDraft(draftFromItem(next));
  };

  const deleteSelected = () => {
    if (!selectedId) {
      return;
    }
    setItems((current) => current.filter((item) => item.id !== selectedId));
    closeItem();
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
                Catalog clothes with useful attributes and see which pieces are meaningfully close.
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
              <Text style={styles.statValue}>{attributeSignalCount}</Text>
              <Text style={styles.statLabel}>Attribute signals</Text>
            </View>
          </View>

          {adding ? (
            <View style={styles.formCard}>
              <Text style={styles.sectionHeading}>Add a piece</Text>
              <Text style={styles.formHint}>
                Structured attributes improve similarity without requiring a model. Leave unknown fields unset.
              </Text>
              <DraftFields draft={newDraft} onChange={setNewDraft} labelPrefix="Clothing" />
              <Pressable
                accessibilityRole="button"
                disabled={!newDraft.name.trim()}
                onPress={addItem}
                style={({ pressed }) => [
                  styles.saveButton,
                  !newDraft.name.trim() && styles.saveButtonDisabled,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.saveButtonText}>Save piece</Text>
              </Pressable>
            </View>
          ) : null}

          {selectedItem && editDraft ? (
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View style={styles.detailIdentity}>
                  <ColorDot color={selectedItem.color} size={44} />
                  <View style={styles.detailCopy}>
                    <Text style={styles.detailName}>{selectedItem.name}</Text>
                    <Text style={styles.detailMeta}>
                      {CATEGORY_LABELS[selectedItem.category]} · {selectedItem.color}
                    </Text>
                    {attributeSummary(selectedItem) ? (
                      <Text style={styles.detailAttributes}>{attributeSummary(selectedItem)}</Text>
                    ) : null}
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close clothing details"
                  onPress={closeItem}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editTitle}>Edit details</Text>
                <DraftFields draft={editDraft} onChange={setEditDraft} labelPrefix="Edit clothing" />
                <View style={styles.editActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!editDraft.name.trim()}
                    onPress={saveSelected}
                    style={({ pressed }) => [
                      styles.saveButton,
                      !editDraft.name.trim() && styles.saveButtonDisabled,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.saveButtonText}>Save changes</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setEditDraft(draftFromItem(selectedItem))}
                    style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}>
                    <Text style={styles.resetButtonText}>Reset changes</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={styles.relatedTitle}>Closest pieces</Text>
              <Text style={styles.relatedIntro}>
                Only evidence known for both pieces enters the normalized score, so missing metadata stays neutral.
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
            placeholder="Search material, season, occasion, fit, tags…"
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
                <ItemCard key={item.id} item={item} onPress={() => openItem(item)} />
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
  fieldLabel: {
    color: '#424c44',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 17,
    marginBottom: 7,
  },
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
  colorChoiceActive: {
    borderColor: '#294333',
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
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
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailCopy: { flex: 1 },
  detailName: { color: '#233027', fontSize: 22, fontWeight: '800' },
  detailMeta: { color: '#667068', fontSize: 13, marginTop: 3, textTransform: 'capitalize' },
  detailAttributes: { color: '#526759', fontSize: 12, marginTop: 5 },
  closeButton: { paddingHorizontal: 8, paddingVertical: 5 },
  closeButtonText: { color: '#526056', fontSize: 13, fontWeight: '800' },
  editSection: {
    backgroundColor: '#f8faf6',
    borderColor: '#d3ddd2',
    borderWidth: 1,
    borderRadius: 17,
    marginTop: 18,
    padding: 14,
  },
  editTitle: { color: '#314238', fontSize: 16, fontWeight: '800' },
  editActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  resetButton: { marginTop: 20, paddingHorizontal: 4, paddingVertical: 10 },
  resetButtonText: { color: '#56635a', fontSize: 13, fontWeight: '800' },
  relatedTitle: { color: '#263128', fontSize: 17, fontWeight: '800', marginTop: 22 },
  relatedIntro: { color: '#687069', fontSize: 13, lineHeight: 20, marginTop: 5 },
  relatedList: { gap: 9, marginTop: 12 },
  relatedCard: { backgroundColor: '#ffffff', borderRadius: 15, padding: 12 },
  relatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
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
  itemAttributes: { color: '#526759', fontSize: 11, marginTop: 6, textTransform: 'capitalize' },
  itemTags: { color: '#6d746e', fontSize: 11, marginTop: 5 },
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
