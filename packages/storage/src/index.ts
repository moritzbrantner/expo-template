export interface AsyncKeyValueStorage {
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
  return `${keyPrefix}-v${version}`;
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
