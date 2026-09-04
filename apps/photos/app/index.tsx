import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadPhotoAssets, requestPhotoAccess, runtimeCapabilities } from '../lib/device';
import { analysePhoto } from '../lib/ml';
import {
  addAnalysedPhoto,
  createAlbum,
  mergePeople,
  personPhotos,
  renamePerson,
  splitFace,
  togglePhotoInAlbum,
} from '../lib/people';
import { loadLibraryState, saveLibraryState } from '../lib/store';
import {
  EMPTY_LIBRARY,
  type FaceObservation,
  type PersonCluster,
  type PhotoAlbum,
  type PhotoAsset,
  type PhotoLibraryState,
} from '../lib/types';

type Tab = 'library' | 'people' | 'albums';

const SCAN_LIMIT = 200;
const capabilities = runtimeCapabilities();

function countFaces(photoId: string, faces: readonly FaceObservation[]) {
  return faces.filter((face) => face.assetId === photoId).length;
}

function monthLabel(timestamp: number) {
  if (!timestamp) {
    return 'Unknown date';
  }
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(timestamp),
  );
}

function dateLabel(timestamp: number) {
  if (!timestamp) {
    return 'Unknown date';
  }
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function groupedByMonth(photos: readonly PhotoAsset[]) {
  const groups = new Map<string, PhotoAsset[]>();
  photos.forEach((photo) => {
    const label = monthLabel(photo.createdAt);
    const group = groups.get(label) ?? [];
    group.push(photo);
    groups.set(label, group);
  });
  return [...groups.entries()];
}

function PhotoTile({
  photo,
  badge,
  selected = false,
  onPress,
}: {
  photo: PhotoAsset;
  badge?: string | null;
  selected?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.photoTile, selected && styles.photoTileSelected]}>
      <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" transition={120} />
      {badge ? (
        <View style={styles.photoBadge}>
          <Text style={styles.photoBadgeText}>{badge}</Text>
        </View>
      ) : null}
      {selected ? (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>✓</Text>
        </View>
      ) : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${photo.filename}`}
      onPress={onPress}>
      {({ pressed }) => <View style={pressed ? styles.pressed : undefined}>{content}</View>}
    </Pressable>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

function PersonCard({
  person,
  faces,
  photos,
  onPress,
}: {
  person: PersonCluster;
  faces: readonly FaceObservation[];
  photos: readonly PhotoAsset[];
  onPress: () => void;
}) {
  const representative = faces.find((face) => face.id === person.representativeFaceId);
  const photo = representative
    ? photos.find((candidate) => candidate.id === representative.assetId)
    : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${person.name ?? 'unnamed person'}`}
      onPress={onPress}
      style={({ pressed }) => [styles.personCard, pressed && styles.pressed]}>
      <View style={styles.personPreview}>
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={styles.personImage}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <View style={styles.imageFallback} />
        )}
      </View>
      <View style={styles.personBody}>
        <Text style={styles.personName}>{person.name ?? 'Unnamed person'}</Text>
        <Text style={styles.personMeta}>
          {person.faceIds.length} {person.faceIds.length === 1 ? 'appearance' : 'appearances'}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function FaceOccurrence({
  face,
  photo,
  canSplit,
  onSplit,
}: {
  face: FaceObservation;
  photo: PhotoAsset;
  canSplit: boolean;
  onSplit: () => void;
}) {
  const boxStyle = {
    left: `${Math.max(0, Math.min(1, face.box.x)) * 100}%` as `${number}%`,
    top: `${Math.max(0, Math.min(1, face.box.y)) * 100}%` as `${number}%`,
    width: `${Math.max(0.04, Math.min(1, face.box.width)) * 100}%` as `${number}%`,
    height: `${Math.max(0.04, Math.min(1, face.box.height)) * 100}%` as `${number}%`,
  };

  return (
    <View style={styles.occurrenceCard}>
      <View style={styles.occurrenceImageWrap}>
        <Image source={{ uri: photo.uri }} style={styles.occurrenceImage} contentFit="cover" />
        <View pointerEvents="none" style={[styles.faceBox, boxStyle]} />
      </View>
      <View style={styles.occurrenceFooter}>
        <View style={styles.occurrenceCopy}>
          <Text style={styles.occurrenceDate}>{dateLabel(photo.createdAt)}</Text>
          <Text style={styles.confidence}>{Math.round(face.score * 100)}% face confidence</Text>
        </View>
        {canSplit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Split this face into a separate person"
            onPress={onSplit}
            style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}>
            <Text style={styles.smallButtonText}>Split</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function AlbumCard({
  album,
  photos,
  onPress,
}: {
  album: PhotoAlbum;
  photos: readonly PhotoAsset[];
  onPress: () => void;
}) {
  const cover = album.assetIds
    .map((id) => photos.find((photo) => photo.id === id))
    .find((photo): photo is PhotoAsset => Boolean(photo));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open album ${album.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.albumCard, pressed && styles.pressed]}>
      <View style={styles.albumCover}>
        {cover ? (
          <Image source={{ uri: cover.uri }} style={styles.albumCoverImage} contentFit="cover" />
        ) : (
          <View style={styles.albumCoverPlaceholder}>
            <Text style={styles.albumCoverPlaceholderText}>Album</Text>
          </View>
        )}
      </View>
      <View style={styles.albumBody}>
        <Text style={styles.albumName}>{album.name}</Text>
        <Text style={styles.albumMeta}>
          {album.assetIds.length} {album.assetIds.length === 1 ? 'photo' : 'photos'}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function PhotosApp() {
  const [library, setLibrary] = useState<PhotoLibraryState>(EMPTY_LIBRARY);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>('library');
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [personName, setPersonName] = useState('');
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [newAlbumName, setNewAlbumName] = useState('');

  useEffect(() => {
    let active = true;
    void loadLibraryState()
      .then((state) => {
        if (active) {
          setLibrary(state);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(`Could not load local photo metadata: ${errorMessage(caught)}`);
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

  const commit = useCallback(async (next: PhotoLibraryState) => {
    setLibrary(next);
    await saveLibraryState(next);
  }, []);

  const scanLibrary = useCallback(async () => {
    if (scanning) {
      return;
    }

    setScanning(true);
    setError(null);
    setScanStatus('Requesting photo access…');

    try {
      const permission = await requestPhotoAccess();
      if (!permission.granted) {
        setError(
          'Photo access is required to index the device library. Nothing was copied or uploaded.',
        );
        return;
      }

      setScanStatus(`Loading the newest ${SCAN_LIMIT} photos…`);
      const assets = await loadPhotoAssets(SCAN_LIMIT);
      const existingIds = new Set(library.photos.map((photo) => photo.id));
      const pending = assets.filter((photo) => !existingIds.has(photo.id));
      let working = library;
      let failedPeopleAnalyses = 0;

      for (let index = 0; index < pending.length; index += 1) {
        const photo = pending[index];
        setScanStatus(`Analysing ${index + 1} of ${pending.length} new photos…`);
        try {
          const analyses = await analysePhoto(photo);
          working = addAnalysedPhoto(working, photo, analyses);
        } catch (caught) {
          failedPeopleAnalyses += 1;
          working = addAnalysedPhoto(working, photo, []);
          if (failedPeopleAnalyses === 1) {
            setError(`People analysis skipped for at least one photo: ${errorMessage(caught)}`);
          }
        }

        if ((index + 1) % 10 === 0) {
          setLibrary(working);
          await saveLibraryState(working);
        }
      }

      working = { ...working, lastScanAt: Date.now() };
      await commit(working);
      setScanStatus(
        pending.length === 0
          ? 'Library is up to date for this scan window.'
          : `Indexed ${pending.length} new ${pending.length === 1 ? 'photo' : 'photos'}.`,
      );
    } catch (caught) {
      setError(`Could not scan the photo library: ${errorMessage(caught)}`);
      setScanStatus(null);
    } finally {
      setScanning(false);
    }
  }, [commit, library, scanning]);

  useEffect(() => {
    if (hydrated && Platform.OS === 'web' && library.photos.length === 0 && !scanning) {
      void scanLibrary();
    }
  }, [hydrated, library.photos.length, scanLibrary, scanning]);

  const people = useMemo(
    () =>
      [...library.people].sort(
        (left, right) =>
          right.faceIds.length - left.faceIds.length || left.id.localeCompare(right.id),
      ),
    [library.people],
  );
  const months = useMemo(() => groupedByMonth(library.photos), [library.photos]);
  const selectedPerson = personId
    ? library.people.find((person) => person.id === personId) ?? null
    : null;
  const selectedAlbum = albumId
    ? library.albums.find((album) => album.id === albumId) ?? null
    : null;

  useEffect(() => {
    setPersonName(selectedPerson?.name ?? '');
  }, [selectedPerson?.id, selectedPerson?.name]);

  const updatePersonName = async () => {
    if (!selectedPerson) {
      return;
    }
    await commit(renamePerson(library, selectedPerson.id, personName));
  };

  const mergeInto = async (targetId: string) => {
    if (!selectedPerson) {
      return;
    }
    const next = mergePeople(library, selectedPerson.id, targetId);
    await commit(next);
    setPersonId(targetId);
  };

  const splitOccurrence = async (faceId: string) => {
    if (!selectedPerson) {
      return;
    }
    await commit(splitFace(library, selectedPerson.id, faceId));
  };

  const addAlbum = async () => {
    const next = createAlbum(library, newAlbumName);
    if (next === library) {
      return;
    }
    setNewAlbumName('');
    await commit(next);
  };

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Opening your local library…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedPerson) {
    const occurrences = selectedPerson.faceIds
      .map((faceId) => library.faces.find((face) => face.id === faceId))
      .filter((face): face is FaceObservation => Boolean(face));
    const photos = personPhotos(selectedPerson, library.faces, library.photos);

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.screen}>
          <Pressable onPress={() => setPersonId(null)} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ People</Text>
          </Pressable>
          <Text style={styles.detailEyebrow}>Person</Text>
          <Text style={styles.detailTitle}>{selectedPerson.name ?? 'Unnamed person'}</Text>
          <Text style={styles.detailCopy}>
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'} ·{' '}
            {selectedPerson.faceIds.length}{' '}
            {selectedPerson.faceIds.length === 1 ? 'appearance' : 'appearances'}
          </Text>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>Name</Text>
            <Text style={styles.sectionCopy}>
              Names are manual. Face similarity never guesses an identity.
            </Text>
            <View style={styles.inlineForm}>
              <TextInput
                accessibilityLabel="Person name"
                autoCapitalize="words"
                placeholder="Add a name"
                placeholderTextColor="#7c817a"
                value={personName}
                onChangeText={setPersonName}
                onSubmitEditing={() => void updatePersonName()}
                style={[styles.input, styles.flexInput]}
              />
              <Pressable
                onPress={() => void updatePersonName()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Appearances</Text>
          <View style={styles.occurrences}>
            {occurrences.map((face) => {
              const photo = library.photos.find((candidate) => candidate.id === face.assetId);
              return photo ? (
                <FaceOccurrence
                  key={face.id}
                  face={face}
                  photo={photo}
                  canSplit={selectedPerson.faceIds.length > 1}
                  onSplit={() => void splitOccurrence(face.id)}
                />
              ) : null;
            })}
          </View>

          {library.people.length > 1 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>Merge duplicate clusters</Text>
              <Text style={styles.sectionCopy}>
                If these appearances belong to another cluster, merge this cluster into it.
              </Text>
              <View style={styles.mergeList}>
                {people
                  .filter((person) => person.id !== selectedPerson.id)
                  .map((person) => (
                    <Pressable
                      key={person.id}
                      onPress={() => void mergeInto(person.id)}
                      style={({ pressed }) => [styles.mergeButton, pressed && styles.pressed]}>
                      <Text style={styles.mergeName}>{person.name ?? 'Unnamed person'}</Text>
                      <Text style={styles.mergeMeta}>
                        {person.faceIds.length} appearances · Merge →
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (selectedAlbum) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.screen}>
          <Pressable onPress={() => setAlbumId(null)} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Albums</Text>
          </Pressable>
          <Text style={styles.detailEyebrow}>Album</Text>
          <Text style={styles.detailTitle}>{selectedAlbum.name}</Text>
          <Text style={styles.detailCopy}>
            Tap photos to add or remove them. Originals remain in the system library.
          </Text>
          {library.photos.length === 0 ? (
            <EmptyState
              title="No indexed photos"
              copy="Scan the photo library first, then return here to fill this album."
            />
          ) : (
            <View style={styles.photoGrid}>
              {library.photos.map((photo) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  selected={selectedAlbum.assetIds.includes(photo.id)}
                  onPress={() =>
                    void commit(togglePhotoInAlbum(library, selectedAlbum.id, photo.id))
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Private photo album</Text>
            <Text style={styles.title}>Photos</Text>
            <Text style={styles.subtitle}>
              Your library, organized locally around moments and people.
            </Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countNumber}>{library.photos.length}</Text>
            <Text style={styles.countLabel}>indexed</Text>
          </View>
        </View>

        <View
          style={[
            styles.capabilityCard,
            !capabilities.nativePeopleDetection && styles.previewCard,
          ]}>
          <View style={styles.capabilityDot} />
          <View style={styles.capabilityCopy}>
            <Text style={styles.capabilityTitle}>{capabilities.label}</Text>
            <Text style={styles.capabilityDetail}>{capabilities.detail}</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Scan note</Text>
            <Text style={styles.errorCopy}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.tabBar}>
          {(['library', 'people', 'albums'] as const).map((item) => {
            const active = tab === item;
            return (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(item)}
                style={[styles.tab, active && styles.tabActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {item === 'library' ? 'Library' : item === 'people' ? 'People' : 'Albums'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'library' ? (
          <>
            <View style={styles.scanPanel}>
              <View style={styles.scanCopy}>
                <Text style={styles.sectionHeading}>Device library</Text>
                <Text style={styles.sectionCopy}>
                  Scan the newest {SCAN_LIMIT} images. Originals stay where they are; only local
                  metadata and face embeddings are stored.
                </Text>
                {scanStatus ? <Text style={styles.scanStatus}>{scanStatus}</Text> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={scanning}
                onPress={() => void scanLibrary()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  scanning && styles.buttonDisabled,
                  pressed && styles.pressed,
                ]}>
                {scanning ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Scan</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{library.faces.length}</Text>
                <Text style={styles.statLabel}>faces</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{library.people.length}</Text>
                <Text style={styles.statLabel}>people</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{library.albums.length}</Text>
                <Text style={styles.statLabel}>albums</Text>
              </View>
            </View>

            {library.photos.length === 0 ? (
              <EmptyState
                title="No photos indexed yet"
                copy="Grant photo access and scan. The app references system-library originals instead of copying them into app storage."
              />
            ) : (
              months.map(([month, photos]) => (
                <View key={month} style={styles.monthSection}>
                  <Text style={styles.sectionTitle}>{month}</Text>
                  <View style={styles.photoGrid}>
                    {photos.map((photo) => {
                      const faces = countFaces(photo.id, library.faces);
                      return (
                        <PhotoTile
                          key={photo.id}
                          photo={photo}
                          badge={faces > 0 ? `${faces} face${faces === 1 ? '' : 's'}` : null}
                        />
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}

        {tab === 'people' ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>People</Text>
                <Text style={styles.sectionCopy}>
                  Clusters are similarity-based and unnamed until you name them.
                </Text>
              </View>
            </View>
            {people.length === 0 ? (
              <EmptyState
                title="No people clusters yet"
                copy="Scan photos containing clear faces. The first native scan downloads the small on-device models, then groups similar face embeddings locally."
              />
            ) : (
              <View style={styles.peopleList}>
                {people.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    faces={library.faces}
                    photos={library.photos}
                    onPress={() => setPersonId(person.id)}
                  />
                ))}
              </View>
            )}
          </>
        ) : null}

        {tab === 'albums' ? (
          <>
            <Text style={styles.sectionTitle}>Albums</Text>
            <Text style={styles.sectionCopy}>
              App albums contain references to your indexed system photos, not duplicate files.
            </Text>
            <View style={styles.inlineForm}>
              <TextInput
                accessibilityLabel="New album name"
                autoCapitalize="words"
                placeholder="Summer 2026"
                placeholderTextColor="#7c817a"
                value={newAlbumName}
                onChangeText={setNewAlbumName}
                onSubmitEditing={() => void addAlbum()}
                style={[styles.input, styles.flexInput]}
              />
              <Pressable
                onPress={() => void addAlbum()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Create</Text>
              </Pressable>
            </View>
            {library.albums.length === 0 ? (
              <EmptyState
                title="No albums yet"
                copy="Create an album, then choose any photos already indexed by this app."
              />
            ) : (
              <View style={styles.albumsList}>
                {[...library.albums]
                  .sort(
                    (left, right) =>
                      right.createdAt - left.createdAt || left.id.localeCompare(right.id),
                  )
                  .map((album) => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      photos={library.photos}
                      onPress={() => setAlbumId(album.id)}
                    />
                  ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f4ef' },
  screen: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 72,
    gap: 18,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { color: '#5f655f', fontSize: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerCopy: { flex: 1, maxWidth: 640 },
  eyebrow: {
    color: '#69716a',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    color: '#1f2821',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  subtitle: { marginTop: 8, maxWidth: 560, color: '#5f675f', fontSize: 16, lineHeight: 23 },
  countPill: {
    minWidth: 72,
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#e6eadf',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  countNumber: { color: '#2d4835', fontSize: 20, fontWeight: '800' },
  countLabel: { color: '#647066', fontSize: 11, fontWeight: '700' },
  capabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    backgroundColor: '#e7efe6',
    padding: 15,
  },
  previewCard: { backgroundColor: '#eee9de' },
  capabilityDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#3d704c' },
  capabilityCopy: { flex: 1 },
  capabilityTitle: { color: '#2a3b2e', fontSize: 14, fontWeight: '800' },
  capabilityDetail: { marginTop: 2, color: '#5d695f', fontSize: 13, lineHeight: 18 },
  errorCard: {
    borderWidth: 1,
    borderColor: '#dec3b1',
    borderRadius: 16,
    backgroundColor: '#fbf1e9',
    padding: 14,
  },
  errorTitle: { color: '#70472f', fontWeight: '800' },
  errorCopy: { marginTop: 4, color: '#775b4a', fontSize: 13, lineHeight: 19 },
  tabBar: { flexDirection: 'row', gap: 6, borderRadius: 16, backgroundColor: '#eae8e2', padding: 5 },
  tab: { flex: 1, alignItems: 'center', borderRadius: 12, paddingVertical: 10 },
  tabActive: { backgroundColor: '#ffffff' },
  tabText: { color: '#6c726c', fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: '#263329' },
  scanPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 17,
  },
  scanCopy: { flex: 1 },
  sectionHeading: { color: '#263129', fontSize: 17, fontWeight: '800' },
  sectionCopy: { marginTop: 4, color: '#697069', fontSize: 13, lineHeight: 19 },
  scanStatus: { marginTop: 7, color: '#3f6c4c', fontSize: 12, fontWeight: '700' },
  primaryButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#315f3e',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.72 },
  statRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 16, backgroundColor: '#ecebe5', padding: 14 },
  statValue: { color: '#28322a', fontSize: 22, fontWeight: '800' },
  statLabel: { marginTop: 2, color: '#777d76', fontSize: 12, fontWeight: '700' },
  emptyState: {
    borderWidth: 1,
    borderColor: '#deddd7',
    borderRadius: 20,
    backgroundColor: '#fdfcf9',
    padding: 24,
  },
  emptyTitle: { color: '#303831', fontSize: 18, fontWeight: '800' },
  emptyCopy: { marginTop: 6, maxWidth: 620, color: '#727870', fontSize: 14, lineHeight: 21 },
  monthSection: { gap: 10 },
  sectionTitle: { color: '#2d372f', fontSize: 19, fontWeight: '800', letterSpacing: -0.25 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  photoTile: {
    position: 'relative',
    width: 112,
    height: 112,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 13,
    backgroundColor: '#deddd8',
  },
  photoTileSelected: { borderColor: '#315f3e' },
  photoImage: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(25, 31, 26, 0.78)',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  photoBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#315f3e',
  },
  selectedBadgeText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  peopleList: { gap: 10 },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 10,
  },
  personPreview: {
    width: 66,
    height: 66,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#e2e1db',
  },
  personImage: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, backgroundColor: '#dfdfd9' },
  personBody: { flex: 1 },
  personName: { color: '#29332b', fontSize: 16, fontWeight: '800' },
  personMeta: { marginTop: 4, color: '#737970', fontSize: 12 },
  chevron: { paddingHorizontal: 6, color: '#858b84', fontSize: 28, fontWeight: '400' },
  inlineForm: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#d8d8d1',
    borderRadius: 13,
    backgroundColor: '#ffffff',
    color: '#273029',
    paddingHorizontal: 13,
    fontSize: 15,
  },
  flexInput: { flex: 1 },
  albumsList: { gap: 10 },
  albumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 10,
  },
  albumCover: {
    width: 70,
    height: 70,
    overflow: 'hidden',
    borderRadius: 15,
    backgroundColor: '#e0ded7',
  },
  albumCoverImage: { width: '100%', height: '100%' },
  albumCoverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  albumCoverPlaceholderText: { color: '#8b8e87', fontSize: 11, fontWeight: '800' },
  albumBody: { flex: 1 },
  albumName: { color: '#29332b', fontSize: 16, fontWeight: '800' },
  albumMeta: { marginTop: 4, color: '#747a73', fontSize: 12 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 5, paddingRight: 14 },
  backButtonText: { color: '#315f3e', fontSize: 15, fontWeight: '800' },
  detailEyebrow: {
    color: '#737a73',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  detailTitle: {
    marginTop: -10,
    color: '#222d25',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  detailCopy: { marginTop: -10, color: '#687068', fontSize: 14, lineHeight: 21 },
  sectionCard: { borderRadius: 20, backgroundColor: '#ffffff', padding: 17, gap: 10 },
  occurrences: { gap: 12 },
  occurrenceCard: { overflow: 'hidden', borderRadius: 18, backgroundColor: '#ffffff' },
  occurrenceImageWrap: {
    position: 'relative',
    width: '100%',
    height: 240,
    backgroundColor: '#e0ded9',
  },
  occurrenceImage: { width: '100%', height: '100%' },
  faceBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#d4f3dd',
    borderRadius: 5,
    backgroundColor: 'rgba(49, 95, 62, 0.08)',
  },
  occurrenceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 13,
  },
  occurrenceCopy: { flex: 1 },
  occurrenceDate: { color: '#334037', fontSize: 13, fontWeight: '800' },
  confidence: { marginTop: 2, color: '#7c817b', fontSize: 11 },
  smallButton: {
    borderWidth: 1,
    borderColor: '#d5d9d3',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: { color: '#405146', fontSize: 12, fontWeight: '800' },
  mergeList: { gap: 8 },
  mergeButton: { borderTopWidth: 1, borderTopColor: '#ecece7', paddingTop: 10 },
  mergeName: { color: '#344038', fontSize: 14, fontWeight: '800' },
  mergeMeta: { marginTop: 2, color: '#777d76', fontSize: 12 },
});
