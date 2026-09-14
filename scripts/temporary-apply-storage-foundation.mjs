import fs from 'node:fs';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const first = source.indexOf(before);
  if (first === -1) {
    throw new Error(`Expected source fragment not found in ${path}`);
  }
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`Source fragment is not unique in ${path}`);
  }
  fs.writeFileSync(path, `${source.slice(0, first)}${after}${source.slice(first + before.length)}`);
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

const rootPackage = readJson('package.json');
rootPackage.workspaces = [
  'apps/habits',
  'apps/tasks',
  'packages/storage',
  'services/auth-api',
];
rootPackage.scripts['test:unit'] = 'bun test ./tests/unit.test.ts ./packages/storage/src/index.test.ts';
writeJson('package.json', rootPackage);

for (const app of ['habits', 'tasks']) {
  const path = `apps/${app}/package.json`;
  const packageJson = readJson(path);
  packageJson.dependencies = sortObject({
    ...packageJson.dependencies,
    '@expo-template/storage': 'workspace:*',
  });
  writeJson(path, packageJson);
}

fs.mkdirSync('packages/storage/src', { recursive: true });
writeJson('packages/storage/package.json', {
  name: '@expo-template/storage',
  version: '0.1.0',
  private: true,
  type: 'module',
  main: './src/index.ts',
  types: './src/index.ts',
  exports: {
    '.': './src/index.ts',
  },
  scripts: {
    test: 'bun test ./src/index.test.ts',
  },
});

fs.writeFileSync(
  'packages/storage/src/index.ts',
  `export interface AsyncKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
}

export type JsonMigration = (value: unknown) => unknown;

export type VersionedJsonStorageOptions<T> = {
  storage: AsyncKeyValueStorage;
  keyPrefix: string;
  version: number;
  decode: (value: unknown) => T | null;
  encode?: (value: T) => unknown;
  fallback: () => T;
  migrations?: Readonly<Partial<Record<number, JsonMigration>>>;
};

type ParsedJson =
  | { ok: true; value: unknown }
  | { ok: false };

function assertVersion(version: number) {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('Storage version must be a positive integer.');
  }
}

export function versionedStorageKey(keyPrefix: string, version: number) {
  if (!keyPrefix.trim()) {
    throw new Error('Storage key prefix cannot be empty.');
  }
  assertVersion(version);
  return \`\${keyPrefix}-v\${version}\`;
}

function parseJson(value: string): ParsedJson {
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch {
    return { ok: false };
  }
}

export function createVersionedJsonStorage<T>(options: VersionedJsonStorageOptions<T>) {
  const { storage, version, migrations } = options;
  const key = versionedStorageKey(options.keyPrefix, version);

  const decode = (value: unknown) => {
    try {
      return options.decode(value);
    } catch {
      return null;
    }
  };

  const serialize = (value: T) => {
    const payload = options.encode ? options.encode(value) : value;
    const serialized = JSON.stringify(payload);
    if (serialized === undefined) {
      throw new Error('Storage value is not JSON serializable.');
    }
    return serialized;
  };

  const load = async (): Promise<T> => {
    try {
      const current = await storage.getItem(key);
      if (current !== null) {
        const parsed = parseJson(current);
        if (!parsed.ok) {
          return options.fallback();
        }
        return decode(parsed.value) ?? options.fallback();
      }

      for (let sourceVersion = version - 1; sourceVersion >= 1; sourceVersion -= 1) {
        const sourceKey = versionedStorageKey(options.keyPrefix, sourceVersion);
        const source = await storage.getItem(sourceKey);
        if (source === null) {
          continue;
        }

        const parsed = parseJson(source);
        if (!parsed.ok) {
          return options.fallback();
        }

        let candidate = parsed.value;
        for (let migrationVersion = sourceVersion; migrationVersion < version; migrationVersion += 1) {
          const migrate = migrations?.[migrationVersion];
          if (!migrate) {
            return options.fallback();
          }
          try {
            candidate = migrate(candidate);
          } catch {
            return options.fallback();
          }
        }

        const decoded = decode(candidate);
        if (decoded === null) {
          return options.fallback();
        }

        await storage.setItem(key, serialize(decoded));
        return decoded;
      }

      return options.fallback();
    } catch {
      return options.fallback();
    }
  };

  const save = async (value: T) => {
    await storage.setItem(key, serialize(value));
  };

  const remove = async () => {
    if (!storage.removeItem) {
      throw new Error('Storage adapter does not support removal.');
    }
    await storage.removeItem(key);
  };

  return { key, load, save, remove };
}
`,
);

fs.writeFileSync(
  'packages/storage/src/index.test.ts',
  `import { describe, expect, test } from 'bun:test';

import { createVersionedJsonStorage, versionedStorageKey } from './index';

class MemoryStorage {
  readonly values = new Map<string, string>();
  readonly writes: Array<{ key: string; value: string }> = [];

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
    this.writes.push({ key, value });
  }

  async removeItem(key: string) {
    this.values.delete(key);
  }
}

function decodeStrings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((candidate) => typeof candidate === 'string')
    ? value
    : null;
}

describe('versionedStorageKey', () => {
  test('keeps the schema version in the storage key', () => {
    expect(versionedStorageKey('@expo-template/tasks/list', 2)).toBe(
      '@expo-template/tasks/list-v2',
    );
  });
});

describe('createVersionedJsonStorage', () => {
  test('loads and saves the current version without changing its JSON shape', async () => {
    const storage = new MemoryStorage();
    storage.values.set('@example/items-v1', JSON.stringify(['one']));
    const store = createVersionedJsonStorage({
      storage,
      keyPrefix: '@example/items',
      version: 1,
      decode: decodeStrings,
      fallback: () => [],
    });

    expect(await store.load()).toEqual(['one']);
    await store.save(['one', 'two']);
    expect(storage.values.get('@example/items-v1')).toBe(JSON.stringify(['one', 'two']));
  });

  test('fails closed on malformed current data instead of resurrecting an older version', async () => {
    const storage = new MemoryStorage();
    storage.values.set('@example/items-v1', JSON.stringify(['old']));
    storage.values.set('@example/items-v2', '{');
    const store = createVersionedJsonStorage({
      storage,
      keyPrefix: '@example/items',
      version: 2,
      decode: decodeStrings,
      fallback: () => ['fallback'],
      migrations: { 1: (value) => value },
    });

    expect(await store.load()).toEqual(['fallback']);
    expect(storage.writes).toEqual([]);
  });

  test('migrates the nearest older version through every declared step and persists it once', async () => {
    const storage = new MemoryStorage();
    storage.values.set('@example/items-v1', JSON.stringify({ items: ['one'] }));
    const store = createVersionedJsonStorage({
      storage,
      keyPrefix: '@example/items',
      version: 3,
      decode: decodeStrings,
      fallback: () => [],
      migrations: {
        1: (value) => {
          if (!value || typeof value !== 'object' || !('items' in value)) return value;
          return (value as { items: unknown }).items;
        },
        2: (value) => value,
      },
    });

    expect(await store.load()).toEqual(['one']);
    expect(storage.writes).toEqual([
      { key: '@example/items-v3', value: JSON.stringify(['one']) },
    ]);
  });

  test('does not partially migrate when a required migration step is missing', async () => {
    const storage = new MemoryStorage();
    storage.values.set('@example/items-v1', JSON.stringify(['one']));
    const store = createVersionedJsonStorage({
      storage,
      keyPrefix: '@example/items',
      version: 3,
      decode: decodeStrings,
      fallback: () => ['fallback'],
      migrations: { 2: (value) => value },
    });

    expect(await store.load()).toEqual(['fallback']);
    expect(storage.writes).toEqual([]);
  });

  test('uses the app-owned encoder before writing generic JSON', async () => {
    const storage = new MemoryStorage();
    const store = createVersionedJsonStorage({
      storage,
      keyPrefix: '@example/items',
      version: 1,
      decode: decodeStrings,
      encode: (value: string[]) => [...value].sort(),
      fallback: () => [],
    });

    await store.save(['two', 'one']);
    expect(storage.values.get('@example/items-v1')).toBe(JSON.stringify(['one', 'two']));
  });
});
`,
);

fs.writeFileSync(
  'packages/storage/README.md',
  `# @expo-template/storage

This package owns generic local persistence mechanics for the mobile-app workspace.

It deliberately does **not** own app schemas or domain migrations. Consumers provide a decoder (and, when needed, an encoder) so Tasks, Habits, and future apps remain authoritative for the shape and validity of their own state.

The key prefix plus an integer schema version produces keys such as \`@expo-template/tasks/list-v1\`. Existing JSON payload shapes are preserved. When a newer version is introduced, every migration step must be declared; missing, malformed, or throwing migrations fail closed to the consumer-provided fallback rather than partially applying or reviving stale data.
`,
);

replaceOnce(
  'apps/tasks/lib/tasks.ts',
  `export function deserializeTasks(value: string | null): Task[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isTask)
      .map((task) => ({ ...task, title: normalizeTaskTitle(task.title) }));
  } catch {
    return [];
  }
}
`,
  `export function parseTasks(value: unknown): Task[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .filter(isTask)
    .map((task) => ({ ...task, title: normalizeTaskTitle(task.title) }));
}

export function deserializeTasks(value: string | null): Task[] {
  if (!value) {
    return [];
  }

  try {
    return parseTasks(JSON.parse(value) as unknown) ?? [];
  } catch {
    return [];
  }
}
`,
);

replaceOnce(
  'apps/habits/lib/habits.ts',
  `export function deserializeHabits(value: string | null): Habit[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((candidate): candidate is Habit => {
      if (!candidate || typeof candidate !== 'object') return false;
      const habit = candidate as Partial<Habit>;
      return (
        typeof habit.id === 'string' &&
        typeof habit.name === 'string' &&
        Number.isInteger(habit.targetPerWeek) &&
        Number(habit.targetPerWeek) >= 1 &&
        Number(habit.targetPerWeek) <= 7 &&
        Array.isArray(habit.completions) &&
        habit.completions.every((day) => typeof day === 'string') &&
        typeof habit.createdAt === 'string'
      );
    });
  } catch {
    return [];
  }
}
`,
  `function isHabit(candidate: unknown): candidate is Habit {
  if (!candidate || typeof candidate !== 'object') return false;
  const habit = candidate as Partial<Habit>;
  return (
    typeof habit.id === 'string' &&
    typeof habit.name === 'string' &&
    Number.isInteger(habit.targetPerWeek) &&
    Number(habit.targetPerWeek) >= 1 &&
    Number(habit.targetPerWeek) <= 7 &&
    Array.isArray(habit.completions) &&
    habit.completions.every((day) => typeof day === 'string') &&
    typeof habit.createdAt === 'string'
  );
}

export function parseHabits(value: unknown): Habit[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(isHabit);
}

export function deserializeHabits(value: string | null): Habit[] {
  if (!value) return [];

  try {
    return parseHabits(JSON.parse(value) as unknown) ?? [];
  } catch {
    return [];
  }
}
`,
);

replaceOnce(
  'apps/tasks/app/index.tsx',
  `import AsyncStorage from '@react-native-async-storage/async-storage';\n`,
  `import AsyncStorage from '@react-native-async-storage/async-storage';\nimport { createVersionedJsonStorage } from '@expo-template/storage';\n`,
);
replaceOnce('apps/tasks/app/index.tsx', '  deserializeTasks,\n', '  parseTasks,\n');
replaceOnce(
  'apps/tasks/app/index.tsx',
  `const STORAGE_KEY = '@expo-template/tasks/list-v1';`,
  `const tasksStorage = createVersionedJsonStorage<Task[]>({
  storage: AsyncStorage,
  keyPrefix: '@expo-template/tasks/list',
  version: 1,
  decode: parseTasks,
  fallback: () => [],
});`,
);
replaceOnce(
  'apps/tasks/app/index.tsx',
  `    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active) {
          setTasks(deserializeTasks(stored));
        }
      })
      .catch(() => {
        // A damaged or unavailable local cache should not prevent the task list from opening.
      })
      .finally(() => {
        if (active) {
          setHydrated(true);
        }
      });`,
  `    void tasksStorage
      .load()
      .then((stored) => {
        if (active) {
          setTasks(stored);
        }
      })
      .finally(() => {
        if (active) {
          setHydrated(true);
        }
      });`,
);
replaceOnce(
  'apps/tasks/app/index.tsx',
  `      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));`,
  `      void tasksStorage.save(tasks).catch(() => {});`,
);

replaceOnce(
  'apps/habits/app/index.tsx',
  `import AsyncStorage from '@react-native-async-storage/async-storage';\n`,
  `import AsyncStorage from '@react-native-async-storage/async-storage';\nimport { createVersionedJsonStorage } from '@expo-template/storage';\n`,
);
replaceOnce('apps/habits/app/index.tsx', '  deserializeHabits,\n', '  parseHabits,\n');
replaceOnce(
  'apps/habits/app/index.tsx',
  `const STORAGE_KEY = '@expo-template/habits/list-v1';`,
  `const habitsStorage = createVersionedJsonStorage<Habit[]>({
  storage: AsyncStorage,
  keyPrefix: '@expo-template/habits/list',
  version: 1,
  decode: parseHabits,
  fallback: () => [],
});`,
);
replaceOnce(
  'apps/habits/app/index.tsx',
  `    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active) setHabits(deserializeHabits(stored));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });`,
  `    void habitsStorage
      .load()
      .then((stored) => {
        if (active) setHabits(stored);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });`,
);
replaceOnce(
  'apps/habits/app/index.tsx',
  `      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(habits));`,
  `      void habitsStorage.save(habits).catch(() => {});`,
);
