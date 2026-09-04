import type {
  FaceAnalysis,
  FaceObservation,
  PersonCluster,
  PhotoAlbum,
  PhotoAsset,
  PhotoLibraryState,
} from './types';

export const DEFAULT_CLUSTER_THRESHOLD = 0.42;

function normalized(vector: readonly number[]) {
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(length) || length === 0) {
    return vector.map(() => 0);
  }
  return vector.map((value) => value / length);
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]) {
  if (left.length === 0 || left.length !== right.length) {
    return -1;
  }
  const a = normalized(left);
  const b = normalized(right);
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function centroidFor(faceIds: readonly string[], faces: readonly FaceObservation[]) {
  const vectors = faceIds
    .map((faceId) => faces.find((face) => face.id === faceId)?.embedding)
    .filter((embedding): embedding is number[] => Boolean(embedding));

  if (vectors.length === 0) {
    return [];
  }

  const dimension = vectors[0].length;
  const centroid = Array.from({ length: dimension }, (_, index) =>
    vectors.reduce((sum, vector) => sum + (vector[index] ?? 0), 0) / vectors.length,
  );
  return normalized(centroid);
}

function uniqueId(prefix: string, existing: readonly { id: string }[]) {
  if (!existing.some((item) => item.id === prefix)) {
    return prefix;
  }

  let suffix = 2;
  while (existing.some((item) => item.id === `${prefix}-${suffix}`)) {
    suffix += 1;
  }
  return `${prefix}-${suffix}`;
}

function placeFace(
  face: FaceObservation,
  people: readonly PersonCluster[],
  faces: readonly FaceObservation[],
  threshold: number,
) {
  let bestIndex = -1;
  let bestScore = -1;

  people.forEach((person, index) => {
    const score = cosineSimilarity(face.embedding, person.centroid);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  if (bestIndex >= 0 && bestScore >= threshold) {
    return people.map((person, index) => {
      if (index !== bestIndex) {
        return person;
      }
      const faceIds = [...person.faceIds, face.id];
      return {
        ...person,
        faceIds,
        centroid: centroidFor(faceIds, [...faces, face]),
      };
    });
  }

  return [
    ...people,
    {
      id: uniqueId(`person-${face.id}`, people),
      name: null,
      faceIds: [face.id],
      centroid: normalized(face.embedding),
      representativeFaceId: face.id,
    },
  ];
}

export function addAnalysedPhoto(
  state: PhotoLibraryState,
  photo: PhotoAsset,
  analyses: readonly FaceAnalysis[],
  threshold = DEFAULT_CLUSTER_THRESHOLD,
): PhotoLibraryState {
  if (state.photos.some((existing) => existing.id === photo.id)) {
    return state;
  }

  let faces = [...state.faces];
  let people = [...state.people];

  analyses.forEach((analysis, index) => {
    const face: FaceObservation = {
      ...analysis,
      id: `${photo.id}:face:${index}`,
      assetId: photo.id,
    };
    people = placeFace(face, people, faces, threshold);
    faces = [...faces, face];
  });

  return {
    ...state,
    photos: [...state.photos, photo].sort(
      (a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id),
    ),
    faces,
    people,
  };
}

export function renamePerson(
  state: PhotoLibraryState,
  personId: string,
  name: string,
): PhotoLibraryState {
  const cleanName = name.trim();
  return {
    ...state,
    people: state.people.map((person) =>
      person.id === personId ? { ...person, name: cleanName || null } : person,
    ),
  };
}

export function mergePeople(
  state: PhotoLibraryState,
  sourceId: string,
  targetId: string,
): PhotoLibraryState {
  if (sourceId === targetId) {
    return state;
  }

  const source = state.people.find((person) => person.id === sourceId);
  const target = state.people.find((person) => person.id === targetId);
  if (!source || !target) {
    return state;
  }

  const faceIds = [...new Set([...target.faceIds, ...source.faceIds])];
  const merged: PersonCluster = {
    ...target,
    faceIds,
    centroid: centroidFor(faceIds, state.faces),
    representativeFaceId: target.representativeFaceId || source.representativeFaceId,
  };

  return {
    ...state,
    people: state.people
      .filter((person) => person.id !== sourceId && person.id !== targetId)
      .concat(merged),
  };
}

export function splitFace(
  state: PhotoLibraryState,
  personId: string,
  faceId: string,
): PhotoLibraryState {
  const person = state.people.find((candidate) => candidate.id === personId);
  const face = state.faces.find((candidate) => candidate.id === faceId);
  if (!person || !face || !person.faceIds.includes(faceId) || person.faceIds.length <= 1) {
    return state;
  }

  const remainingFaceIds = person.faceIds.filter((id) => id !== faceId);
  const remaining: PersonCluster = {
    ...person,
    faceIds: remainingFaceIds,
    centroid: centroidFor(remainingFaceIds, state.faces),
    representativeFaceId:
      person.representativeFaceId === faceId ? remainingFaceIds[0] : person.representativeFaceId,
  };

  const separated: PersonCluster = {
    id: uniqueId(`person-${faceId}-split`, state.people),
    name: null,
    faceIds: [faceId],
    centroid: normalized(face.embedding),
    representativeFaceId: faceId,
  };

  return {
    ...state,
    people: state.people
      .filter((candidate) => candidate.id !== personId)
      .concat(remaining, separated),
  };
}

export function createAlbum(
  state: PhotoLibraryState,
  name: string,
  now = Date.now(),
): PhotoLibraryState {
  const cleanName = name.trim();
  if (!cleanName) {
    return state;
  }

  const album: PhotoAlbum = {
    id: uniqueId(`album-${now}`, state.albums),
    name: cleanName,
    assetIds: [],
    createdAt: now,
  };

  return { ...state, albums: [...state.albums, album] };
}

export function togglePhotoInAlbum(
  state: PhotoLibraryState,
  albumId: string,
  assetId: string,
): PhotoLibraryState {
  return {
    ...state,
    albums: state.albums.map((album) => {
      if (album.id !== albumId) {
        return album;
      }
      const contains = album.assetIds.includes(assetId);
      return {
        ...album,
        assetIds: contains
          ? album.assetIds.filter((id) => id !== assetId)
          : [...album.assetIds, assetId],
      };
    }),
  };
}

export function personPhotos(
  person: PersonCluster,
  faces: readonly FaceObservation[],
  photos: readonly PhotoAsset[],
) {
  const assetIds = new Set(
    person.faceIds
      .map((faceId) => faces.find((face) => face.id === faceId)?.assetId)
      .filter((assetId): assetId is string => Boolean(assetId)),
  );
  return photos.filter((photo) => assetIds.has(photo.id));
}
