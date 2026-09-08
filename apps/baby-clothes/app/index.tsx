import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  BABY_CLOTHING_CATEGORIES,
  BABY_CLOTHING_SIZE_PRESETS,
  BABY_CLOTHING_STATUSES,
  babyClothingSizePreset,
  createBabyClothingEntry,
  deserializeBabyClothingEntries,
  filterBabyClothingEntries,
  formatBabyClothingSize,
  updateBabyClothingEntry,
  type BabyClothingCategory,
  type BabyClothingDraft,
  type BabyClothingEntry,
  type BabyClothingPhoto,
  type BabyClothingStatus,
  type BabyClothingStatusFilter,
} from '../lib/clothing';
import { persistBabyClothingPhoto, removeBabyClothingPhoto } from '../lib/media';

const STORAGE_KEY = 'baby-clothes.entries-v1';

const CATEGORY_LABELS: Record<BabyClothingCategory, string> = {
  bodysuit: 'Bodysuit',
  sleeper: 'Sleeper',
  top: 'Top',
  bottom: 'Bottom',
  'one-piece': 'One-piece',
  outerwear: 'Outerwear',
  dress: 'Dress',
  'socks-tights': 'Socks / tights',
  hat: 'Hat',
  bib: 'Bib',
  shoes: 'Shoes',
  other: 'Other',
};

const STATUS_LABELS: Record<BabyClothingStatus, string> = {
  'too-large': 'Too large',
  'in-use': 'In use',
  dirty: 'Dirty',
  stored: 'Stored',
  'too-small': 'Too small',
  'donated-sold': 'Donated / sold',
};

type EditorState = {
  id: string;
  existing: BabyClothingEntry | null;
  draft: BabyClothingDraft;
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function newDraft(): BabyClothingDraft {
  return {
    name: '',
    category: 'bodysuit',
    brand: '',
    originalSizeLabel: '',
    normalizedSize: null,
    entryType: 'single',
    quantity: 1,
    status: 'in-use',
    photos: [],
    notes: '',
  };
}

function draftFromEntry(entry: BabyClothingEntry): BabyClothingDraft {
  return {
    name: entry.name,
    category: entry.category,
    brand: entry.brand,
    originalSizeLabel: entry.originalSizeLabel,
    normalizedSize: entry.normalizedSize,
    entryType: entry.entryType,
    quantity: entry.quantity,
    status: entry.status,
    photos: entry.photos,
    notes: entry.notes,
  };
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export default function BabyClothesScreen() {
  const [entries, setEntries] = useState<BabyClothingEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BabyClothingStatusFilter>('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (active) {
          setEntries(deserializeBabyClothingEntries(value));
        }
      })
      .catch(() => {
        if (active) {
          setStorageError('Local clothing data could not be loaded.');
        }
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
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(() => {
      setStorageError('Local clothing changes could not be saved.');
    });
  }, [entries, hydrated]);

  const sizeRange = sizeFilter === 'all' ? null : babyClothingSizePreset(sizeFilter);
  const visibleEntries = useMemo(
    () => filterBabyClothingEntries(entries, query, statusFilter, sizeRange),
    [entries, query, sizeRange, statusFilter],
  );

  function openNewEntry() {
    setEditor({ id: makeId('clothes'), existing: null, draft: newDraft() });
    setEditorError(null);
    setPhotoStatus(null);
    setDeleteArmed(false);
  }

  function openEntry(entry: BabyClothingEntry) {
    setEditor({ id: entry.id, existing: entry, draft: draftFromEntry(entry) });
    setEditorError(null);
    setPhotoStatus(null);
    setDeleteArmed(false);
  }

  function updateDraft(patch: Partial<BabyClothingDraft>) {
    setEditor((current) =>
      current ? { ...current, draft: { ...current.draft, ...patch } } : current,
    );
    setEditorError(null);
    setDeleteArmed(false);
  }

  async function addPhoto(source: 'camera' | 'library') {
    if (!editor || photoBusy) {
      return;
    }

    setPhotoBusy(true);
    setPhotoStatus(null);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setPhotoStatus('Camera permission is required only to take a clothing photo.');
          return;
        }
      } else if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setPhotoStatus('Photo-library permission is required only to choose a clothing photo.');
          return;
        }
      }

      const options = {
        mediaTypes: ['images'] as ImagePicker.MediaType[],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 0.85,
        base64: Platform.OS === 'web',
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const photo = await persistBabyClothingPhoto(
        editor.id,
        result.assets[0],
        makeId('photo'),
      );
      setEditor((current) =>
        current && current.id === editor.id
          ? {
              ...current,
              draft: { ...current.draft, photos: [...current.draft.photos, photo] },
            }
          : current,
      );
    } catch (error) {
      setPhotoStatus(error instanceof Error ? error.message : 'The clothing photo could not be added.');
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhotoFromDraft(photo: BabyClothingPhoto) {
    if (!editor) {
      return;
    }
    updateDraft({ photos: editor.draft.photos.filter((candidate) => candidate.id !== photo.id) });
  }

  async function cancelEditor() {
    if (!editor) {
      return;
    }
    const originalUris = new Set(editor.existing?.photos.map((photo) => photo.uri) ?? []);
    const addedPhotos = editor.draft.photos.filter((photo) => !originalUris.has(photo.uri));
    await Promise.all(addedPhotos.map((photo) => removeBabyClothingPhoto(photo))).catch(() => undefined);
    setEditor(null);
    setEditorError(null);
    setPhotoStatus(null);
    setDeleteArmed(false);
  }

  async function saveEditor() {
    if (!editor) {
      return;
    }

    try {
      const next = editor.existing
        ? updateBabyClothingEntry(editor.existing, editor.draft)
        : createBabyClothingEntry(editor.draft, editor.id);

      setEntries((current) =>
        editor.existing
          ? current.map((entry) => (entry.id === next.id ? next : entry))
          : [next, ...current],
      );

      const retainedUris = new Set(next.photos.map((photo) => photo.uri));
      const removedPhotos =
        editor.existing?.photos.filter((photo) => !retainedUris.has(photo.uri)) ?? [];
      await Promise.all(removedPhotos.map((photo) => removeBabyClothingPhoto(photo))).catch(
        () => undefined,
      );

      setEditor(null);
      setEditorError(null);
      setPhotoStatus(null);
      setDeleteArmed(false);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'The clothing entry could not be saved.');
    }
  }

  async function deleteEntry() {
    if (!editor?.existing) {
      return;
    }
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }

    await Promise.all(editor.existing.photos.map((photo) => removeBabyClothingPhoto(photo))).catch(
      () => undefined,
    );
    setEntries((current) => current.filter((entry) => entry.id !== editor.existing?.id));
    setEditor(null);
    setDeleteArmed(false);
  }

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading local wardrobe…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>LOCAL BABY WARDROBE</Text>
            <Text style={styles.title}>Baby clothes</Text>
            <Text style={styles.subtitle}>
              Photos, printed sizes, normalized fit ranges, and lifecycle state stay on this device.
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={openNewEntry} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>+ Add clothes</Text>
          </Pressable>
        </View>

        {storageError ? <Text style={styles.errorBanner}>{storageError}</Text> : null}

        <TextInput
          accessibilityLabel="Search baby clothes"
          onChangeText={setQuery}
          placeholder="Search name, brand, printed size…"
          placeholderTextColor="#88847d"
          style={styles.searchInput}
          value={query}
        />

        <FieldLabel>Lifecycle</FieldLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <ChoiceChip label="All" selected={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
          {BABY_CLOTHING_STATUSES.map((status) => (
            <ChoiceChip
              key={status}
              label={STATUS_LABELS[status]}
              selected={statusFilter === status}
              onPress={() => setStatusFilter(status)}
            />
          ))}
        </ScrollView>

        <FieldLabel>Normalized size</FieldLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <ChoiceChip label="All" selected={sizeFilter === 'all'} onPress={() => setSizeFilter('all')} />
          {BABY_CLOTHING_SIZE_PRESETS.map((preset) => (
            <ChoiceChip
              key={preset.id}
              label={preset.label}
              selected={sizeFilter === preset.id}
              onPress={() => setSizeFilter(preset.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.list}>
          {visibleEntries.map((entry) => {
            const firstPhoto = entry.photos[0];
            return (
              <Pressable
                accessibilityRole="button"
                key={entry.id}
                onPress={() => openEntry(entry)}
                style={styles.entryCard}
              >
                {firstPhoto ? (
                  <Image source={{ uri: firstPhoto.uri }} resizeMode="cover" style={styles.entryPhoto} />
                ) : (
                  <View style={[styles.entryPhoto, styles.photoPlaceholder]}>
                    <Text style={styles.photoPlaceholderText}>Add photo</Text>
                  </View>
                )}
                <View style={styles.entryContent}>
                  <View style={styles.entryTitleRow}>
                    <View style={styles.entryTitleCopy}>
                      <Text style={styles.entryName}>{entry.name}</Text>
                      <Text style={styles.entryMeta}>
                        {CATEGORY_LABELS[entry.category]}
                        {entry.brand ? ` · ${entry.brand}` : ''}
                      </Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>{STATUS_LABELS[entry.status]}</Text>
                    </View>
                  </View>
                  <Text style={styles.sizeLine}>
                    {entry.originalSizeLabel ? `Label ${entry.originalSizeLabel}` : 'No printed size'} ·{' '}
                    {formatBabyClothingSize(entry.normalizedSize)}
                  </Text>
                  {entry.entryType === 'group' ? (
                    <Text style={styles.groupLine}>{entry.quantity} identical pieces grouped together</Text>
                  ) : (
                    <Text style={styles.groupLine}>Individual garment</Text>
                  )}
                  {entry.notes ? <Text numberOfLines={2} style={styles.notesPreview}>{entry.notes}</Text> : null}
                </View>
              </Pressable>
            );
          })}

          {visibleEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No clothes match this view.</Text>
              <Text style={styles.muted}>
                Add a garment or change the lifecycle, size, or search filters.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal animationType="slide" onRequestClose={() => void cancelEditor()} visible={editor !== null}>
        <SafeAreaView style={styles.modalSafeArea}>
          {editor ? (
            <ScrollView contentContainerStyle={styles.editorPage} keyboardShouldPersistTaps="handled">
              <View style={styles.editorHeader}>
                <View>
                  <Text style={styles.eyebrow}>{editor.existing ? 'EDIT CLOTHING' : 'NEW CLOTHING'}</Text>
                  <Text style={styles.editorTitle}>{editor.existing ? editor.existing.name : 'Add baby clothes'}</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => void cancelEditor()} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
              </View>

              <FieldLabel>Photos</FieldLabel>
              <View style={styles.photoActions}>
                {Platform.OS !== 'web' ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={photoBusy}
                    onPress={() => void addPhoto('camera')}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Take photo</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={photoBusy}
                  onPress={() => void addPhoto('library')}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Choose photo</Text>
                </Pressable>
                {photoBusy ? <ActivityIndicator /> : null}
              </View>
              {photoStatus ? <Text style={styles.helperError}>{photoStatus}</Text> : null}
              {editor.draft.photos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
                  {editor.draft.photos.map((photo) => (
                    <View key={photo.id} style={styles.photoTile}>
                      <Image source={{ uri: photo.uri }} resizeMode="cover" style={styles.photoTileImage} />
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => removePhotoFromDraft(photo)}
                        style={styles.removePhotoButton}
                      >
                        <Text style={styles.removePhotoText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.muted}>Add one or more photos; the first becomes the catalog thumbnail.</Text>
              )}

              <FieldLabel>Track as</FieldLabel>
              <View style={styles.wrapRow}>
                <ChoiceChip
                  label="Individual garment"
                  selected={editor.draft.entryType === 'single'}
                  onPress={() => updateDraft({ entryType: 'single', quantity: 1 })}
                />
                <ChoiceChip
                  label="Group identical pieces"
                  selected={editor.draft.entryType === 'group'}
                  onPress={() => updateDraft({ entryType: 'group', quantity: Math.max(1, editor.draft.quantity) })}
                />
              </View>

              {editor.draft.entryType === 'group' ? (
                <View style={styles.quantityRow}>
                  <FieldLabel>Quantity</FieldLabel>
                  <View style={styles.stepper}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => updateDraft({ quantity: Math.max(1, editor.draft.quantity - 1) })}
                      style={styles.stepButton}
                    >
                      <Text style={styles.stepButtonText}>−</Text>
                    </Pressable>
                    <Text style={styles.quantityValue}>{editor.draft.quantity}</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => updateDraft({ quantity: editor.draft.quantity + 1 })}
                      style={styles.stepButton}
                    >
                      <Text style={styles.stepButtonText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <FieldLabel>Name</FieldLabel>
              <TextInput
                onChangeText={(name) => updateDraft({ name })}
                placeholder="e.g. Blue wrap bodysuit"
                placeholderTextColor="#88847d"
                style={styles.input}
                value={editor.draft.name}
              />

              <FieldLabel>Category</FieldLabel>
              <View style={styles.wrapRow}>
                {BABY_CLOTHING_CATEGORIES.map((category) => (
                  <ChoiceChip
                    key={category}
                    label={CATEGORY_LABELS[category]}
                    selected={editor.draft.category === category}
                    onPress={() => updateDraft({ category })}
                  />
                ))}
              </View>

              <FieldLabel>Brand</FieldLabel>
              <TextInput
                onChangeText={(brand) => updateDraft({ brand })}
                placeholder="Optional"
                placeholderTextColor="#88847d"
                style={styles.input}
                value={editor.draft.brand}
              />

              <FieldLabel>Printed size label</FieldLabel>
              <TextInput
                onChangeText={(originalSizeLabel) => updateDraft({ originalSizeLabel })}
                placeholder="e.g. 62, 0–3M, 50/56"
                placeholderTextColor="#88847d"
                style={styles.input}
                value={editor.draft.originalSizeLabel}
              />
              <Text style={styles.helperText}>Kept exactly as your reference evidence; it is not silently converted.</Text>

              <FieldLabel>Normalized fit range</FieldLabel>
              <View style={styles.wrapRow}>
                <ChoiceChip
                  label="Not set"
                  selected={editor.draft.normalizedSize === null}
                  onPress={() => updateDraft({ normalizedSize: null })}
                />
                {BABY_CLOTHING_SIZE_PRESETS.map((preset) => (
                  <ChoiceChip
                    key={preset.id}
                    label={preset.label}
                    selected={
                      editor.draft.normalizedSize?.minCm === preset.minCm &&
                      editor.draft.normalizedSize?.maxCm === preset.maxCm
                    }
                    onPress={() =>
                      updateDraft({ normalizedSize: { minCm: preset.minCm, maxCm: preset.maxCm } })
                    }
                  />
                ))}
              </View>

              <FieldLabel>Lifecycle state</FieldLabel>
              <View style={styles.wrapRow}>
                {BABY_CLOTHING_STATUSES.map((status) => (
                  <ChoiceChip
                    key={status}
                    label={STATUS_LABELS[status]}
                    selected={editor.draft.status === status}
                    onPress={() => updateDraft({ status })}
                  />
                ))}
              </View>

              <FieldLabel>Notes</FieldLabel>
              <TextInput
                multiline
                onChangeText={(notes) => updateDraft({ notes })}
                placeholder="Drawer, season, special details…"
                placeholderTextColor="#88847d"
                style={[styles.input, styles.notesInput]}
                textAlignVertical="top"
                value={editor.draft.notes}
              />

              {editorError ? <Text style={styles.helperError}>{editorError}</Text> : null}

              <Pressable accessibilityRole="button" onPress={() => void saveEditor()} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save clothing</Text>
              </Pressable>

              {editor.existing ? (
                <Pressable accessibilityRole="button" onPress={() => void deleteEntry()} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>
                    {deleteArmed ? 'Tap again to delete permanently' : 'Delete clothing entry'}
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f3ed' },
  modalSafeArea: { flex: 1, backgroundColor: '#fbfaf7' },
  page: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: 20, paddingBottom: 48, gap: 12 },
  loading: { flex: 1, minHeight: 480, alignItems: 'center', justifyContent: 'center', gap: 12 },
  headerRow: { flexDirection: 'row', gap: 18, alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  headerCopy: { flex: 1, maxWidth: 680 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: '#776f63' },
  title: { fontSize: 38, lineHeight: 42, fontWeight: '800', color: '#211f1b', marginTop: 4 },
  subtitle: { fontSize: 16, lineHeight: 23, color: '#5d5850', marginTop: 8 },
  primaryButton: { backgroundColor: '#24372c', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  secondaryButton: { borderWidth: 1, borderColor: '#cfc8bc', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryButtonText: { color: '#332f29', fontSize: 14, fontWeight: '700' },
  searchInput: { borderWidth: 1, borderColor: '#d7d0c4', backgroundColor: '#ffffff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#211f1b' },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: '#514b43', marginTop: 8 },
  chipRow: { gap: 8, paddingRight: 14 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#d5cec2', backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipSelected: { borderColor: '#24372c', backgroundColor: '#e7eee9' },
  chipText: { color: '#5d5850', fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: '#24372c' },
  list: { gap: 12, marginTop: 8 },
  entryCard: { flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: '#ddd6ca', backgroundColor: '#ffffff', borderRadius: 18, padding: 12 },
  entryPhoto: { width: 104, height: 124, borderRadius: 13, backgroundColor: '#eeeae2' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  photoPlaceholderText: { color: '#777169', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  entryContent: { flex: 1, minWidth: 0, gap: 6, paddingVertical: 2 },
  entryTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  entryTitleCopy: { flex: 1, minWidth: 0 },
  entryName: { color: '#211f1b', fontSize: 18, fontWeight: '800' },
  entryMeta: { color: '#716a61', fontSize: 13, marginTop: 3 },
  statusBadge: { backgroundColor: '#f0ece4', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusBadgeText: { color: '#4c463f', fontSize: 11, fontWeight: '800' },
  sizeLine: { color: '#3f3a34', fontSize: 14, lineHeight: 20 },
  groupLine: { color: '#716a61', fontSize: 13 },
  notesPreview: { color: '#716a61', fontSize: 13, lineHeight: 18 },
  emptyState: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#d2cabd', borderRadius: 18, padding: 24, backgroundColor: '#faf8f3', gap: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#332f29' },
  muted: { color: '#716a61', fontSize: 14, lineHeight: 20 },
  errorBanner: { backgroundColor: '#fff0ed', color: '#8a2f22', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: '700' },
  editorPage: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 52, gap: 10 },
  editorHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8 },
  editorTitle: { fontSize: 28, fontWeight: '800', color: '#211f1b', marginTop: 3 },
  photoActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
  photoStrip: { gap: 10, paddingVertical: 4 },
  photoTile: { width: 132, gap: 6 },
  photoTileImage: { width: 132, height: 154, borderRadius: 14, backgroundColor: '#eeeae2' },
  removePhotoButton: { alignSelf: 'flex-start', paddingVertical: 4 },
  removePhotoText: { color: '#8a2f22', fontSize: 12, fontWeight: '800' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepButton: { width: 38, height: 38, borderWidth: 1, borderColor: '#cfc8bc', backgroundColor: '#ffffff', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepButtonText: { fontSize: 23, color: '#332f29', lineHeight: 25 },
  quantityValue: { minWidth: 28, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#211f1b' },
  input: { borderWidth: 1, borderColor: '#d7d0c4', backgroundColor: '#ffffff', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, fontSize: 16, color: '#211f1b' },
  notesInput: { minHeight: 96 },
  helperText: { fontSize: 12, lineHeight: 17, color: '#777169', marginTop: -4 },
  helperError: { fontSize: 13, lineHeight: 18, color: '#9b3427', fontWeight: '700' },
  saveButton: { marginTop: 10, backgroundColor: '#24372c', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' },
  saveButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  deleteButton: { marginTop: 2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
  deleteButtonText: { color: '#9b3427', fontSize: 14, fontWeight: '800' },
});
