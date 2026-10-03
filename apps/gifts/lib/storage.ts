import {
  createLocalJsonStore,
  type LocalStorageAdapter,
} from '@expo-template/local-storage';

import {
  deserializeGiftState,
  emptyGiftState,
  type GiftState,
  serializeGiftState,
} from './gifts';

export const GIFTS_STORAGE_KEY = '@expo-template/gifts/state-v1';

export function createGiftStateStore(storage?: LocalStorageAdapter) {
  return createLocalJsonStore<GiftState>({
    key: GIFTS_STORAGE_KEY,
    deserialize: deserializeGiftState,
    fallback: emptyGiftState,
    serialize: serializeGiftState,
    ...(storage ? { storage } : {}),
  });
}

const giftStateStore = createGiftStateStore();

export async function loadGiftState(): Promise<GiftState> {
  return giftStateStore.load();
}

export async function saveGiftState(state: GiftState): Promise<void> {
  await giftStateStore.save(state);
}
