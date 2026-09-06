import { describe, expect, test } from 'bun:test';

import { createLibraryBook } from './books';

describe('createLibraryBook', () => {
  test('keeps personal writing separate from fetched metadata', () => {
    const book = createLibraryBook(
      '9780141182803',
      {
        title: 'The Brothers Karamazov',
        authors: ['Fyodor Dostoevsky'],
        publisher: 'Penguin Classics',
      },
      new Date('2026-09-06T12:00:00.000Z'),
    );

    expect(book.notes).toBe('');
    expect(book.review).toBe('');
    expect(book.keyIdeas).toBe('');
    expect(book.meaning).toBe('');
    expect(book.title).toBe('The Brothers Karamazov');
    expect(book.authors).toEqual(['Fyodor Dostoevsky']);
  });
});
