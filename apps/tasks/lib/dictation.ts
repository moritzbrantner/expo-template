import {
  DEFAULT_DICTATION_COMMANDS,
  type DictationCommands,
} from './dictation-settings';
import { normalizeTaskTitle } from './tasks';

export type DictationParseResult = {
  /** Completed entries in newest-first order, ready for the task list's prepend semantics. */
  completedEntries: string[];
  remainder: string;
  finishRequested: boolean;
};

function normalizeCommandToken(token: string) {
  return token.toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function isCommand(token: string, command: string) {
  return normalizeCommandToken(token) === command;
}

export function parseDictationInput(
  value: string,
  commands: DictationCommands = DEFAULT_DICTATION_COMMANDS,
): DictationParseResult {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  const finishRequested = tokens.length > 0 && isCommand(tokens.at(-1) ?? '', commands.done);
  const contentTokens = finishRequested ? tokens.slice(0, -1) : tokens;
  const entries: string[][] = [[]];
  let foundNextCommand = false;

  for (const token of contentTokens) {
    if (isCommand(token, commands.next)) {
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
