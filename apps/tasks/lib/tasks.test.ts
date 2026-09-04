import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearCompleted,
  createTask,
  deserializeTasks,
  filterTasks,
  normalizeTaskTitle,
  toggleTask,
  type Task,
} from './tasks';

test('normalizes task titles and rejects empty input', () => {
  assert.equal(normalizeTaskTitle('  Call   dentist  '), 'Call dentist');
  assert.equal(normalizeTaskTitle('\nBuy\t milk\n tomorrow  '), 'Buy milk tomorrow');
  assert.throws(() => createTask('   ', '1'), /cannot be empty/i);
});

test('creates and toggles a deterministic task without changing stable fields', () => {
  const created = createTask('  Write   report ', 'task-1', new Date('2026-09-03T08:00:00.000Z'));
  assert.deepEqual(created, {
    id: 'task-1',
    title: 'Write report',
    completed: false,
    createdAt: '2026-09-03T08:00:00.000Z',
    completedAt: null,
  });

  const completed = toggleTask(created, new Date('2026-09-03T09:00:00.000Z'));
  assert.deepEqual(
    {
      id: completed.id,
      title: completed.title,
      createdAt: completed.createdAt,
    },
    {
      id: created.id,
      title: created.title,
      createdAt: created.createdAt,
    },
  );
  assert.equal(completed.completed, true);
  assert.equal(completed.completedAt, '2026-09-03T09:00:00.000Z');

  const reopened = toggleTask(completed, new Date('2026-09-03T10:00:00.000Z'));
  assert.equal(reopened.completed, false);
  assert.equal(reopened.completedAt, null);
  assert.equal(reopened.createdAt, created.createdAt);
});

test('filters tasks without reordering them', () => {
  const firstOpen = createTask('First open', 'open-1');
  const done = toggleTask(createTask('Done', 'done'));
  const secondOpen = createTask('Second open', 'open-2');
  const source = [firstOpen, done, secondOpen];

  assert.deepEqual(filterTasks(source, 'open').map((task) => task.id), ['open-1', 'open-2']);
  assert.deepEqual(filterTasks(source, 'done').map((task) => task.id), ['done']);
  assert.deepEqual(filterTasks(source, 'all').map((task) => task.id), [
    'open-1',
    'done',
    'open-2',
  ]);
});

test('filter all and clear completed return independent arrays', () => {
  const open = createTask('Open', 'open');
  const done = toggleTask(createTask('Done', 'done'));
  const source = [open, done];

  const all = filterTasks(source, 'all');
  const remaining = clearCompleted(source);

  all.pop();
  remaining.push(createTask('Other', 'other'));

  assert.deepEqual(source.map((task) => task.id), ['open', 'done']);
  assert.deepEqual(clearCompleted(source).map((task) => task.id), ['open']);
});

test('hydrates valid stored tasks, normalizes titles, and preserves stored order', () => {
  const first: Task = {
    id: 'first',
    title: '  First   task ',
    completed: false,
    createdAt: '2026-09-03T08:00:00.000Z',
    completedAt: null,
  };
  const second: Task = {
    id: 'second',
    title: 'Second task',
    completed: true,
    createdAt: '2026-09-03T09:00:00.000Z',
    completedAt: '2026-09-03T10:00:00.000Z',
  };

  assert.deepEqual(deserializeTasks(JSON.stringify([first, second])), [
    { ...first, title: 'First task' },
    second,
  ]);
});

test('drops malformed stored entries while retaining valid neighbors', () => {
  const valid = createTask('Saved task', 'saved', new Date('2026-09-03T08:00:00.000Z'));
  const malformedEntries = [
    null,
    'task',
    {},
    { ...valid, id: '' },
    { ...valid, title: '   ' },
    { ...valid, completed: 'false' },
    { ...valid, createdAt: 123 },
    { ...valid, completedAt: 123 },
  ];

  assert.deepEqual(deserializeTasks(JSON.stringify([malformedEntries[0], valid, ...malformedEntries.slice(1)])), [
    valid,
  ]);
});

test('tolerates missing, corrupt, and non-array storage payloads', () => {
  assert.deepEqual(deserializeTasks(null), []);
  assert.deepEqual(deserializeTasks(''), []);
  assert.deepEqual(deserializeTasks('{not-json'), []);
  assert.deepEqual(deserializeTasks(JSON.stringify({ task: 'not-an-array' })), []);
});
