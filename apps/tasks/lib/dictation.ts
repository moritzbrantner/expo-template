import { normalizeTaskTitle } from './tasks';

export type DictationParseResult = {
  completedEntries: string[];
  remainder: string;
};

function isNextCommand(token: string) {
  const bareToken = token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  return bareToken === 'next';
}

export function parseDictationInput(value: string): DictationParseResult {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  const entries: string[][] = [[]];
  let foundCommand = false;

  for (const token of tokens) {
    if (isNextCommand(token)) {
      foundCommand = true;
      entries.push([]);
      continue;
    }

    entries[entries.length - 1]?.push(token);
  }

  if (!foundCommand) {
    return {
      completedEntries: [],
      remainder: normalizeTaskTitle(value),
    };
  }

  const remainder = normalizeTaskTitle(entries.at(-1)?.join(' ') ?? '');
  const completedEntries = entries
    .slice(0, -1)
    .map((entry) => normalizeTaskTitle(entry.join(' ')))
    .filter(Boolean);

  return { completedEntries, remainder };
}
