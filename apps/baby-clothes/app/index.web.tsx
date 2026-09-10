import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import BabyClothesScreen from '../components/BabyClothesScreen';
import { BABY_CLOTHING_PREVIEW_ENTRIES } from '../lib/preview-catalog';

const STORAGE_KEY = 'baby-clothes.entries-v1';
const PREVIEW_SEED_KEY = 'baby-clothes.preview-seeded-v1';

function storageIsEmpty(value: string | null) {
  if (value === null) {
    return true;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.length === 0;
  } catch {
    return false;
  }
}

export default function BabyClothesWebPreview() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    void Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(PREVIEW_SEED_KEY)])
      .then(async ([storedEntries, previewSeeded]) => {
        if (previewSeeded !== null || !storageIsEmpty(storedEntries)) {
          return;
        }

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(BABY_CLOTHING_PREVIEW_ENTRIES));
        await AsyncStorage.setItem(PREVIEW_SEED_KEY, '1');
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return null;
  }

  return <BabyClothesScreen />;
}
