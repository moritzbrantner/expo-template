import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearCompleted,
  createTask,
  deserializeTasks,
  filterTasks,
  normalizeTaskTitle,
  toggleTask,
} from './tasks';

test('normalizes task titles and rejects empty input', () => {
  assert.equal(normalizeTaskTitle('  Call   dentist  '), 'Call dentist');
  assert.throws(() => createTask('   ', '1'), /cannot be empty/i);
});

test('creates and toggles a deterministic task', () => {
  const created = createTask('Write report', 'task-1', new Date('2026-09-03T08:00:00.000Z'));
  assert.deepEqual(created, {
    id: 'task-1',
    title: 'Write report',
    completed: false,
    createdAt: '2026-09-03T08:00:00.000Z',
    completedAt: null,
  });

  const completed = toggleTask(created, new Date('2026-09-03T09:00:00.000Z'));
  assert.equal(completed.completed, true);
  assert.equal(completed.completedAt, '2026-09-03T09:00:00.000Z');

  const reopened = toggleTask(completed);
  assert.equal(reopened.completed, false);
  assert.equal(reopened.completedAt, null);
});

test('filters and clears completed tasks without mutating the source list', () => {
  const open = createTask('Open', 'open');
  const done = toggleTask(createTask('Done', 'done'));
  const source = [open, done];

  assert.deepEqual(filterTasks(source, 'open').map((task) => task.id), ['open']);
  assert.deepEqual(filterTasks(source, 'done').map((task) => task.id), ['done']);
  assert.deepEqual(filterTasks(source, 'all').map((task) => task.id), ['open', 'done']);
  assert.deepEqual(clearCompleted(source).map((task) => task.id), ['open']);
  assert.equal(source.length, 2);
});

test('hydrates only valid stored tasks and tolerates corrupt storage', () => {
  const valid = createTask('Saved task', 'saved');
  const mixed = JSON.stringify([valid, { title: 'broken' }]);

  assert.deepEqual(deserializeTasks(mixed), [valid]);
  assert.deepEqual(deserializeTasks('{not-json'), []);
  assert.deepEqual(deserializeTasks(null), []);
});
