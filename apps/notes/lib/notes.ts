export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeTitle(title: string, body: string): string {
  const trimmedTitle = title.trim();
  if (trimmedTitle) return trimmedTitle;

  const firstLine = body.trim().split(/\r?\n/, 1)[0]?.trim();
  return firstLine ? firstLine.slice(0, 60) : 'Untitled';
}

export function createNote(title: string, body: string, id: string, now = new Date()): Note {
  if (!title.trim() && !body.trim()) throw new Error('A note needs a title or body.');
  const timestamp = now.toISOString();
  return {
    id,
    title: normalizeTitle(title, body),
    body: body.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateNote(note: Note, title: string, body: string, now = new Date()): Note {
  if (!title.trim() && !body.trim()) throw new Error('A note needs a title or body.');
  return {
    ...note,
    title: normalizeTitle(title, body),
    body: body.trim(),
    updatedAt: now.toISOString(),
  };
}

export function orderNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function deserializeNotes(value: string | null): Note[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((candidate): candidate is Note => {
      if (!candidate || typeof candidate !== 'object') return false;
      const note = candidate as Partial<Note>;
      return (
        typeof note.id === 'string' &&
        typeof note.title === 'string' &&
        typeof note.body === 'string' &&
        typeof note.createdAt === 'string' &&
        typeof note.updatedAt === 'string'
      );
    });
  } catch {
    return [];
  }
}
