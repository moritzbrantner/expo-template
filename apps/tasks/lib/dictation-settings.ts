export type DictationCommands = {
  next: string;
  done: string;
};

export const DEFAULT_DICTATION_COMMANDS: DictationCommands = {
  next: 'next',
  done: 'done',
};

export const DICTATION_COMMANDS_STORAGE_KEY = '@expo-template/tasks/dictation-commands-v1';

export function normalizeDictationCommandWord(value: string) {
  return value.trim().toLowerCase();
}

export function createDictationCommands(next: string, done: string): DictationCommands | null {
  const normalizedNext = normalizeDictationCommandWord(next);
  const normalizedDone = normalizeDictationCommandWord(done);

  if (!normalizedNext || !normalizedDone) {
    return null;
  }

  if (/\s/.test(normalizedNext) || /\s/.test(normalizedDone)) {
    return null;
  }

  if (normalizedNext === normalizedDone) {
    return null;
  }

  return {
    next: normalizedNext,
    done: normalizedDone,
  };
}

export function deserializeDictationCommands(value: string | null): DictationCommands {
  if (!value) {
    return DEFAULT_DICTATION_COMMANDS;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_DICTATION_COMMANDS;
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.next !== 'string' || typeof record.done !== 'string') {
      return DEFAULT_DICTATION_COMMANDS;
    }

    return createDictationCommands(record.next, record.done) ?? DEFAULT_DICTATION_COMMANDS;
  } catch {
    return DEFAULT_DICTATION_COMMANDS;
  }
}
