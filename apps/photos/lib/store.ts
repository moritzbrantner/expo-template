import AsyncStorage from '@react-native-async-storage/async-storage';

import { EMPTY_LIBRARY, type PhotoLibraryState } from './types';

const STORAGE_KEY = '@expo-template/photos/library-v1';

export async function loadLibraryState(): Promise<PhotoLibraryState> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return EMPTY_LIBRARY;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<PhotoLibraryState>;
    if (parsed.version !== 1) {
      return EMPTY_LIBRARY;
    }
    return {
      version: 1,
      photos: Array.isArray(parsed.photos) ? parsed.photos : [],
      faces: Array.isArray(parsed.faces) ? parsed.faces : [],
      people: Array.isArray(parsed.people) ? parsed.people : [],
      albums: Array.isArray(parsed.albums) ? parsed.albums : [],
      lastScanAt: typeof parsed.lastScanAt === 'number' ? parsed.lastScanAt : null,
    };
  } catch {
    return EMPTY_LIBRARY;
  }
}

export async function saveLibraryState(state: PhotoLibraryState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function clearLibraryState() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
