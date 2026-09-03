import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  clearCompleted,
  createTask,
  deserializeTasks,
  filterTasks,
  toggleTask,
  type Task,
  type TaskFilter,
} from '../lib/tasks';

const STORAGE_KEY = '@expo-template/tasks/list-v1';
const FILTERS: { value: TaskFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Done' },
];

function taskId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.taskRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        accessibilityLabel={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.checkbox,
          task.completed && styles.checkboxChecked,
          pressed && styles.pressed,
        ]}>
        {task.completed ? <Text style={styles.checkmark}>✓</Text> : null}
      </Pressable>

      <Text
        style={[styles.taskTitle, task.completed && styles.taskTitleDone]}
        accessibilityRole="text">
        {task.title}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${task.title}`}
        onPress={onDelete}
        hitSlop={8}
        style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
        <Text style={styles.deleteText}>Delete</Text>
      </Pressable>
    </View>
  );
}

export default function TasksApp() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<TaskFilter>('open');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active) {
          setTasks(deserializeTasks(stored));
        }
      })
      .catch(() => {
        // A damaged or unavailable local cache should not prevent the task list from opening.
      })
      .finally(() => {
        if (active) {
          setHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }, 150);

    return () => clearTimeout(timer);
  }, [hydrated, tasks]);

  const visibleTasks = useMemo(() => filterTasks(tasks, filter), [filter, tasks]);
  const openCount = tasks.filter((task) => !task.completed).length;
  const doneCount = tasks.length - openCount;

  const addTask = () => {
    const title = draft.trim();
    if (!title) {
      return;
    }

    setTasks((current) => [createTask(title, taskId()), ...current]);
    setDraft('');
    setFilter('open');
  };

  const emptyMessage =
    tasks.length === 0
      ? 'Nothing here yet. Add one thing worth doing.'
      : filter === 'open'
        ? 'Everything is complete.'
        : filter === 'done'
          ? 'No completed tasks yet.'
          : 'No tasks to show.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>TASKS</Text>
          <Text style={styles.heading}>Write it down. Finish it. Move on.</Text>
          <Text style={styles.summary}>
            {openCount} open · {doneCount} done
          </Text>

          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="New task"
              autoCapitalize="sentences"
              blurOnSubmit={false}
              onChangeText={setDraft}
              onSubmitEditing={addTask}
              placeholder="What needs doing?"
              placeholderTextColor="#7b827c"
              returnKeyType="done"
              style={styles.input}
              value={draft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!draft.trim()}
              onPress={addTask}
              style={({ pressed }) => [
                styles.addButton,
                !draft.trim() && styles.addButtonDisabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>

          <View style={styles.filterRow} accessibilityRole="tablist">
            {FILTERS.map((option) => {
              const selected = filter === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setFilter(option.value)}
                  style={({ pressed }) => [
                    styles.filterButton,
                    selected && styles.filterButtonSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.filterText,
                      selected && styles.filterTextSelected,
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.list}>
            {visibleTasks.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>{emptyMessage}</Text>
              </View>
            ) : (
              visibleTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() =>
                    setTasks((current) =>
                      current.map((candidate) =>
                        candidate.id === task.id ? toggleTask(candidate) : candidate,
                      ),
                    )
                  }
                  onDelete={() =>
                    setTasks((current) =>
                      current.filter((candidate) => candidate.id !== task.id),
                    )
                  }
                />
              ))
            )}
          </View>

          {doneCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setTasks((current) => clearCompleted(current))}
              style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
              <Text style={styles.clearText}>Clear completed</Text>
            </Pressable>
          ) : null}

          <Text style={styles.footer}>
            Stored on this device. No account, feed, streak, or tracking required.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 48,
  },
  eyebrow: {
    color: '#657067',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heading: {
    color: '#1f2921',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 39,
    marginTop: 8,
    maxWidth: 560,
  },
  summary: {
    color: '#687068',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  composer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 26,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    backgroundColor: '#ffffff',
    borderColor: '#d7d9d2',
    borderWidth: 1,
    borderRadius: 15,
    color: '#1e2720',
    fontSize: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  addButton: {
    minWidth: 72,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#243c2b',
    borderRadius: 15,
    paddingHorizontal: 16,
  },
  addButtonDisabled: { opacity: 0.38 },
  addButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  filterButton: {
    borderColor: '#cfd3cc',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterButtonSelected: {
    backgroundColor: '#e1e9df',
    borderColor: '#adc0ad',
  },
  filterText: { color: '#687068', fontSize: 13, fontWeight: '700' },
  filterTextSelected: { color: '#294331' },
  list: {
    borderTopColor: '#d9dbd5',
    borderTopWidth: 1,
    marginTop: 20,
  },
  taskRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomColor: '#d9dbd5',
    borderBottomWidth: 1,
    paddingVertical: 11,
  },
  checkbox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#9ea79f',
    borderWidth: 1.5,
    borderRadius: 9,
    backgroundColor: '#faf9f5',
  },
  checkboxChecked: {
    backgroundColor: '#31513a',
    borderColor: '#31513a',
  },
  checkmark: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  taskTitle: {
    flex: 1,
    color: '#263029',
    fontSize: 16,
    lineHeight: 22,
  },
  taskTitleDone: {
    color: '#858b85',
    textDecorationLine: 'line-through',
  },
  deleteButton: { paddingVertical: 8, paddingLeft: 8 },
  deleteText: { color: '#8c4a45', fontSize: 12, fontWeight: '700' },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 34,
  },
  emptyText: {
    color: '#747b75',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  clearButton: {
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingVertical: 8,
  },
  clearText: { color: '#675d57', fontSize: 13, fontWeight: '700' },
  footer: {
    color: '#868b86',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 28,
  },
  pressed: { opacity: 0.68 },
});
