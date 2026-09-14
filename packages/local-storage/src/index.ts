import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocalStorageAdapter = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

export type LocalJsonStoreOptions<T> = {
  key: string;
  deserialize: (stored: string | null) => T;
  fallback: () => T;
  serialize?: (value: T) => string;
  migrate?: (stored: string | null) => string | null;
  storage?: LocalStorageAdapter;
};

export type LocalJsonStore<T> = {
  load: () => Promise<T>;
  save: (value: T) => Promise<void>;
};

export function createLocalJsonStore<T>({
  key,
  deserialize,
  fallback,
  serialize = JSON.stringify,
  migrate,
  storage = AsyncStorage,
}: LocalJsonStoreOptions<T>): LocalJsonStore<T> {
  return {
    async load() {
      try {
        const stored = await storage.getItem(key);
        return deserialize(migrate ? migrate(stored) : stored);
      } catch {
        return fallback();
      }
    },
    async save(value) {
      await storage.setItem(key, serialize(value));
    },
  };
}
