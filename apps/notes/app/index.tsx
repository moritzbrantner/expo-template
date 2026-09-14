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

import { createNote, deserializeNotes, orderNotes, updateNote, type Note } from '../lib/notes';

const STORAGE_KEY = '@expo-template/notes/list-v1';

function noteId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formattedDate(timestamp: string) {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

export default function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active) setNotes(deserializeNotes(stored));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }, 150);
    return () => clearTimeout(timer);
  }, [notes, hydrated]);

  const orderedNotes = useMemo(() => orderNotes(notes), [notes]);
  const canSave = Boolean(title.trim() || body.trim());

  const beginNew = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
  };

  const beginEdit = (note: Note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
  };

  const save = () => {
    if (!canSave) return;
    if (editingId) {
      setNotes((current) =>
        current.map((note) => note.id === editingId ? updateNote(note, title, body) : note),
      );
    } else {
      setNotes((current) => [...current, createNote(title, body, noteId())]);
    }
    beginNew();
  };

  const removeNote = (id: string) => {
    setNotes((current) => current.filter((note) => note.id !== id));
    if (editingId === id) beginNew();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>NOTES</Text>
              <Text style={styles.heading}>Write it down plainly.</Text>
            </View>
            {editingId ? (
              <Pressable onPress={beginNew} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>New note</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.editorCard}>
            <TextInput
              accessibilityLabel="Note title"
              onChangeText={setTitle}
              placeholder="Title (optional)"
              placeholderTextColor="#7b827c"
              style={styles.titleInput}
              value={title}
            />
            <TextInput
              accessibilityLabel="Note body"
              multiline
              onChangeText={setBody}
              placeholder="Write a note…"
              placeholderTextColor="#7b827c"
              style={styles.bodyInput}
              textAlignVertical="top"
              value={body}
            />
            <Pressable
              disabled={!canSave}
              onPress={save}
              style={({ pressed }) => [styles.primaryButton, !canSave && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>{editingId ? 'Update note' : 'Save note'}</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Your notes</Text>
          <View style={styles.list}>
            {orderedNotes.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No notes yet.</Text>
                <Text style={styles.emptyText}>Use the editor above when something is worth keeping.</Text>
              </View>
            ) : (
              orderedNotes.map((note) => (
                <View key={note.id} style={[styles.noteCard, editingId === note.id && styles.noteCardSelected]}>
                  <Pressable onPress={() => beginEdit(note)} style={({ pressed }) => [styles.noteMain, pressed && styles.pressed]}>
                    <Text style={styles.noteTitle}>{note.title}</Text>
                    {note.body ? <Text numberOfLines={3} style={styles.noteBody}>{note.body}</Text> : null}
                    <Text style={styles.noteMeta}>Updated {formattedDate(note.updatedAt)}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Delete ${note.title}`}
                    onPress={() => removeNote(note.id)}
                    style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <Text style={styles.footer}>Stored on this device. No account, feed, analytics, or cloud ownership in this MVP.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  headerRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 16, justifyContent: 'space-between' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#657067', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#1f2921', fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1, marginTop: 8 },
  secondaryButton: { borderColor: '#bfc6bf', borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  secondaryButtonText: { color: '#405047', fontSize: 13, fontWeight: '700' },
  editorCard: { backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 20, padding: 16, gap: 10, marginTop: 24 },
  titleInput: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 14, color: '#1f2921', fontSize: 18, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 12 },
  bodyInput: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 14, color: '#1f2921', fontSize: 16, lineHeight: 23, minHeight: 160, paddingHorizontal: 14, paddingVertical: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: '#243c2b', borderRadius: 14, paddingVertical: 13 },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.4 },
  sectionTitle: { color: '#273129', fontSize: 18, fontWeight: '800', marginTop: 24 },
  list: { gap: 10, marginTop: 12 },
  noteCard: { backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  noteCardSelected: { borderColor: '#8ea08f' },
  noteMain: { padding: 16 },
  noteTitle: { color: '#243027', fontSize: 17, fontWeight: '800' },
  noteBody: { color: '#5f6861', fontSize: 14, lineHeight: 21, marginTop: 7 },
  noteMeta: { color: '#858b86', fontSize: 11, marginTop: 10 },
  deleteButton: { alignSelf: 'flex-start', marginBottom: 12, marginLeft: 16, paddingVertical: 3 },
  deleteText: { color: '#8c4a45', fontSize: 12, fontWeight: '700' },
  emptyCard: { backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 20, padding: 22 },
  emptyTitle: { color: '#243027', fontSize: 18, fontWeight: '800' },
  emptyText: { color: '#737a74', fontSize: 14, lineHeight: 21, marginTop: 6 },
  footer: { color: '#868b86', fontSize: 12, lineHeight: 18, marginTop: 26 },
  pressed: { opacity: 0.68 },
});
