export type PhotoAsset = {
  id: string;
  uri: string;
  filename: string;
  width: number;
  height: number;
  createdAt: number;
};

export type FaceBox = { x: number; y: number; width: number; height: number };

export type FaceAnalysis = { box: FaceBox; score: number; embedding: number[] };

export type FaceObservation = FaceAnalysis & { id: string; assetId: string };

export type PersonCluster = {
  id: string;
  name: string | null;
  faceIds: string[];
  centroid: number[];
  representativeFaceId: string;
};

export type PhotoAlbum = { id: string; name: string; assetIds: string[]; createdAt: number };

export type PhotoLibraryState = {
  version: 1;
  photos: PhotoAsset[];
  faces: FaceObservation[];
  people: PersonCluster[];
  albums: PhotoAlbum[];
  lastScanAt: number | null;
};

export type RuntimeCapabilities = {
  nativePeopleDetection: boolean;
  label: string;
  detail: string;
};

export const EMPTY_LIBRARY: PhotoLibraryState = {
  version: 1,
  photos: [],
  faces: [],
  people: [],
  albums: [],
  lastScanAt: null,
};
