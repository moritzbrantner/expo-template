import { normalizeTaskTitle } from './tasks';

export type DictationParseResult = {
  /** Completed entries in newest-first order, ready for the task list's prepend semantics. */
  completedEntries: string[];
  remainder: string;
  finishRequested: boolean;
};

function normalizeCommandToken(token: string) {
  return token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}

function isCommand(token: string, command: 'next' | 'done') {
  return normalizeCommandToken(token) === command;
}

export function parseDictationInput(value: string): DictationParseResult {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  const finishRequested = tokens.length > 0 && isCommand(tokens.at(-1) ?? '', 'done');
  const contentTokens = finishRequested ? tokens.slice(0, -1) : tokens;
  const entries: string[][] = [[]];
  let foundNextCommand = false;

  for (const token of contentTokens) {
    if (isCommand(token, 'next')) {
      foundNextCommand = true;
      entries.push([]);
      continue;
    }

    entries[entries.length - 1]?.push(token);
  }

  if (finishRequested) {
    const completedEntries = entries
      .map((entry) => normalizeTaskTitle(entry.join(' ')))
      .filter(Boolean)
      .reverse();

    return {
      completedEntries,
      remainder: '',
      finishRequested: true,
    };
  }

  if (!foundNextCommand) {
    return {
      completedEntries: [],
      remainder: normalizeTaskTitle(value),
      finishRequested: false,
    };
  }

  const remainder = normalizeTaskTitle(entries.at(-1)?.join(' ') ?? '');
  const completedEntries = entries
    .slice(0, -1)
    .map((entry) => normalizeTaskTitle(entry.join(' ')))
    .filter(Boolean)
    .reverse();

  return { completedEntries, remainder, finishRequested: false };
}
