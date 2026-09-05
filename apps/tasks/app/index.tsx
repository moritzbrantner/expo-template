import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  DEFAULT_DICTATION_COMMANDS,
  DICTATION_COMMANDS_STORAGE_KEY,
  deserializeDictationCommands,
  type DictationCommands,
} from '../lib/dictation-settings';
import { parseDictationInput } from '../lib/dictation';
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

type BrowserSpeechAlternative = {
  transcript: string;
};

type BrowserSpeechResult = {
  isFinal: boolean;
  length: number;
  [index: number]: BrowserSpeechAlternative;
};

type BrowserSpeechEvent = {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechResult>;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BrowserSpeechEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function getBrowserSpeechRecognitionConstructor() {
  if (Platform.OS !== 'web') {
    return null;
  }

  const speechGlobal = globalThis as typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

  return speechGlobal.SpeechRecognition ?? speechGlobal.webkitSpeechRecognition ?? null;
}

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
  const [dictationMode, setDictationMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [dictationStatus, setDictationStatus] = useState<string | null>(null);
  const [dictationCommands, setDictationCommands] = useState<DictationCommands>(
    DEFAULT_DICTATION_COMMANDS,
  );
  const draftRef = useRef('');
  const inputRef = useRef<TextInput>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void AsyncStorage.getItem(DICTATION_COMMANDS_STORAGE_KEY)
        .then((stored) => {
          if (active) {
            setDictationCommands(deserializeDictationCommands(stored));
          }
        })
        .catch(() => {
          if (active) {
            setDictationCommands(DEFAULT_DICTATION_COMMANDS);
          }
        });

      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(
    () => () => {
      const recognition = recognitionRef.current;
      if (!recognition) {
        return;
      }

      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    },
    [],
  );

  const visibleTasks = useMemo(() => filterTasks(tasks, filter), [filter, tasks]);
  const openCount = tasks.filter((task) => !task.completed).length;
  const doneCount = tasks.length - openCount;

  const updateDraft = (value: string) => {
    draftRef.current = value;
    setDraft(value);
  };

  const addTaskTitles = (titles: readonly string[]) => {
    const normalizedTitles = titles.map((title) => title.trim()).filter(Boolean);
    if (normalizedTitles.length === 0) {
      return;
    }

    setTasks((current) => [
      ...normalizedTitles.map((title) => createTask(title, taskId())),
      ...current,
    ]);
    setFilter('open');
  };

  const addTask = () => {
    const title = draftRef.current.trim();
    if (!title) {
      return;
    }

    addTaskTitles([title]);
    updateDraft('');
  };

  const finishDictation = () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      setDictationStatus('Finishing dictation…');
      recognition.stop();
      return;
    }

    const remainingTitle = draftRef.current.trim();
    if (remainingTitle) {
      addTaskTitles([remainingTitle]);
    }
    updateDraft('');
    setDictationMode(false);
    setDictationStatus(null);
  };

  const consumeDictationInput = (value: string) => {
    const { completedEntries, remainder, finishRequested } = parseDictationInput(
      value,
      dictationCommands,
    );
    addTaskTitles(completedEntries);
    updateDraft(remainder);

    if (finishRequested) {
      finishDictation();
    }

    return finishRequested;
  };

  const startDictation = () => {
    setDictationMode(true);

    const Recognition = getBrowserSpeechRecognitionConstructor();
    if (!Recognition) {
      setDictationStatus(
        `Dictation mode is on. Use the keyboard microphone: say “${dictationCommands.next}” for a new task and “${dictationCommands.done}” to finish.`,
      );
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    const recognition = new Recognition();
    let failed = false;

    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result?.isFinal) {
          continue;
        }

        const transcript = result[0]?.transcript?.trim();
        if (!transcript) {
          continue;
        }

        const finishRequested = consumeDictationInput(
          [draftRef.current, transcript].filter(Boolean).join(' '),
        );
        if (finishRequested) {
          break;
        }
      }
    };
    recognition.onerror = () => {
      failed = true;
      setIsListening(false);
      setDictationStatus('Speech recognition stopped. You can continue with the keyboard microphone.');
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);

      if (failed) {
        setDictationStatus('Speech recognition stopped. Use the keyboard microphone to keep dictating.');
        setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }

      const remainingTitle = draftRef.current.trim();
      if (remainingTitle) {
        addTaskTitles([remainingTitle]);
      }
      updateDraft('');
      setDictationMode(false);
      setDictationStatus(null);
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      setDictationStatus(
        `Listening… “${dictationCommands.next}” starts another task. “${dictationCommands.done}” finishes dictation.`,
      );
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setDictationStatus('Speech recognition is unavailable here. Use the keyboard microphone instead.');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
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
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>TASKS</Text>
            <Link href="/settings" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open settings"
                style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
                <Text style={styles.settingsText}>Settings</Text>
              </Pressable>
            </Link>
          </View>
          <Text style={styles.heading}>Write it down. Finish it. Move on.</Text>
          <Text style={styles.summary}>
            {openCount} open · {doneCount} done
          </Text>

          <View style={styles.composer}>
            <TextInput
              ref={inputRef}
              accessibilityLabel={dictationMode ? 'Dictated task' : 'New task'}
              autoCapitalize="sentences"
              blurOnSubmit={false}
              onChangeText={(value) =>
                dictationMode ? consumeDictationInput(value) : updateDraft(value)
              }
              onSubmitEditing={addTask}
              placeholder={
                dictationMode
                  ? `Say a task, “${dictationCommands.next}”, or “${dictationCommands.done}”…`
                  : 'What needs doing?'
              }
              placeholderTextColor="#7b827c"
              returnKeyType="done"
              style={[styles.input, dictationMode && styles.inputDictating]}
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

          <View style={styles.dictationRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: dictationMode }}
              accessibilityLabel={dictationMode ? 'Finish dictation' : 'Start dictation'}
              onPress={dictationMode ? finishDictation : startDictation}
              style={({ pressed }) => [
                styles.dictationButton,
                dictationMode && styles.dictationButtonActive,
                pressed && styles.pressed,
              ]}>
              <Text
                style={[
                  styles.dictationButtonText,
                  dictationMode && styles.dictationButtonTextActive,
                ]}>
                {isListening ? 'Stop dictation' : dictationMode ? 'Finish dictation' : 'Dictate'}
              </Text>
            </Pressable>
            <Text style={styles.dictationHelp} accessibilityLiveRegion="polite">
              {dictationStatus ??
                `Dictate several tasks hands-free. “${dictationCommands.next}” starts a new entry; “${dictationCommands.done}” finishes.`}
            </Text>
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

          <View style={styles.footerRow}>
            <Text style={styles.footer}>
              Tasks stay stored on this device. Speech recognition is handled by your browser or
              keyboard provider.
            </Text>
            <Link href="/about" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="About"
                hitSlop={8}
                style={({ pressed }) => [styles.aboutLink, pressed && styles.pressed]}>
                <Text style={styles.aboutText}>About</Text>
              </Pressable>
            </Link>
          </View>
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
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: '#657067',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  settingsButton: {
    borderColor: '#cfd3cc',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  settingsText: { color: '#405247', fontSize: 12, fontWeight: '800' },
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
  inputDictating: {
    borderColor: '#7d9f83',
    borderWidth: 2,
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
  dictationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  dictationButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderColor: '#b8c0b8',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dictationButtonActive: {
    backgroundColor: '#31513a',
    borderColor: '#31513a',
  },
  dictationButtonText: {
    color: '#405247',
    fontSize: 13,
    fontWeight: '800',
  },
  dictationButtonTextActive: { color: '#ffffff' },
  dictationHelp: {
    flex: 1,
    color: '#747b75',
    fontSize: 12,
    lineHeight: 17,
  },
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
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 28,
  },
  footer: {
    color: '#868b86',
    fontSize: 12,
    lineHeight: 18,
  },
  aboutLink: {
    paddingVertical: 2,
  },
  aboutText: {
    color: '#737a74',
    fontSize: 12,
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
  pressed: { opacity: 0.68 },
});