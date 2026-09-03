export type Task = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
};

export type TaskFilter = 'open' | 'all' | 'done';

export function normalizeTaskTitle(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function createTask(
  title: string,
  id: string,
  now = new Date(),
): Task {
  const normalizedTitle = normalizeTaskTitle(title);
  if (!normalizedTitle) {
    throw new Error('Task title cannot be empty.');
  }

  return {
    id,
    title: normalizedTitle,
    completed: false,
    createdAt: now.toISOString(),
    completedAt: null,
  };
}

export function toggleTask(task: Task, now = new Date()): Task {
  const completed = !task.completed;
  return {
    ...task,
    completed,
    completedAt: completed ? now.toISOString() : null,
  };
}

export function filterTasks(tasks: readonly Task[], filter: TaskFilter) {
  if (filter === 'all') {
    return [...tasks];
  }

  const completed = filter === 'done';
  return tasks.filter((task) => task.completed === completed);
}

export function clearCompleted(tasks: readonly Task[]) {
  return tasks.filter((task) => !task.completed);
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const task = value as Partial<Task>;
  return (
    typeof task.id === 'string' &&
    task.id.length > 0 &&
    typeof task.title === 'string' &&
    normalizeTaskTitle(task.title).length > 0 &&
    typeof task.completed === 'boolean' &&
    typeof task.createdAt === 'string' &&
    (task.completedAt === null || typeof task.completedAt === 'string')
  );
}

export function deserializeTasks(value: string | null): Task[] {
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
