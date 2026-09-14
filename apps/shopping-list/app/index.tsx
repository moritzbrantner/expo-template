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
  clearPurchased,
  createShoppingItem,
  deserializeShoppingItems,
  orderShoppingItems,
  toggleShoppingItem,
  type ShoppingItem,
} from '../lib/shopping-list';

const STORAGE_KEY = '@expo-template/shopping-list/items-v1';

function itemId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ShoppingRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.itemRow, item.purchased && styles.itemRowPurchased]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.purchased }}
        accessibilityLabel={`${item.purchased ? 'Unmark' : 'Mark'} ${item.name} purchased`}
        onPress={onToggle}
        style={({ pressed }) => [styles.itemMain, pressed && styles.pressed]}>
        <View style={[styles.checkbox, item.purchased && styles.checkboxChecked]}>
          {item.purchased ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <View style={styles.itemCopy}>
          <Text style={[styles.itemName, item.purchased && styles.itemNamePurchased]}>{item.name}</Text>
          {item.quantity ? <Text style={styles.quantity}>{item.quantity}</Text> : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name}`}
        onPress={onDelete}
        style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
        <Text style={styles.removeText}>Remove</Text>
      </Pressable>
    </View>
  );
}

export default function ShoppingListApp() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [draft, setDraft] = useState('');
  const [quantity, setQuantity] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active) setItems(deserializeShoppingItems(stored));
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
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, 150);
    return () => clearTimeout(timer);
  }, [items, hydrated]);

  const orderedItems = useMemo(() => orderShoppingItems(items), [items]);
  const hasPurchased = items.some((item) => item.purchased);

  const addItem = () => {
    if (!draft.trim()) return;
    setItems((current) => [...current, createShoppingItem(draft, itemId(), quantity)]);
    setDraft('');
    setQuantity('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>SHOPPING LIST</Text>
          <Text style={styles.heading}>Get what you need, then leave.</Text>
          <Text style={styles.subtitle}>A private list for groceries and ordinary errands.</Text>

          <View style={styles.composerCard}>
            <TextInput
              accessibilityLabel="Shopping item"
              autoCapitalize="sentences"
              onChangeText={setDraft}
              onSubmitEditing={addItem}
              placeholder="Milk, apples, detergent…"
              placeholderTextColor="#7b827c"
              returnKeyType="done"
              style={styles.input}
              value={draft}
            />
            <TextInput
              accessibilityLabel="Quantity or qualifier"
              onChangeText={setQuantity}
              onSubmitEditing={addItem}
              placeholder="Optional quantity — 2 kg, large…"
              placeholderTextColor="#7b827c"
              returnKeyType="done"
              style={styles.input}
              value={quantity}
            />
            <Pressable
              disabled={!draft.trim()}
              onPress={addItem}
              style={({ pressed }) => [styles.primaryButton, !draft.trim() && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Add item</Text>
            </Pressable>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>List</Text>
            {hasPurchased ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setItems((current) => clearPurchased(current))}
                style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.clearText}>Clear purchased</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.list}>
            {orderedItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nothing to buy.</Text>
                <Text style={styles.emptyText}>Add only what you actually need.</Text>
              </View>
            ) : (
              orderedItems.map((item) => (
                <ShoppingRow
                  key={item.id}
                  item={item}
                  onToggle={() =>
                    setItems((current) =>
                      current.map((candidate) => candidate.id === item.id ? toggleShoppingItem(candidate) : candidate),
                    )
                  }
                  onDelete={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
                />
              ))
            )}
          </View>

          <Text style={styles.footer}>Stored on this device. No account, shopping feed, recommendations, or tracking.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  eyebrow: { color: '#657067', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#1f2921', fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1, marginTop: 8 },
  subtitle: { color: '#687068', fontSize: 14, lineHeight: 21, marginTop: 10 },
  composerCard: { backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 20, padding: 16, gap: 10, marginTop: 24 },
  input: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 14, color: '#1f2921', fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: '#243c2b', borderRadius: 14, paddingVertical: 13 },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.4 },
  listHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  sectionTitle: { color: '#273129', fontSize: 18, fontWeight: '800' },
  clearText: { color: '#7c4a42', fontSize: 13, fontWeight: '700' },
  list: { gap: 10, marginTop: 12 },
  itemRow: { alignItems: 'center', backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 18, flexDirection: 'row', minHeight: 68, paddingHorizontal: 14 },
  itemRowPurchased: { opacity: 0.62 },
  itemMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, paddingVertical: 13 },
  checkbox: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#9eaaa0', borderRadius: 10, borderWidth: 1, height: 26, justifyContent: 'center', width: 26 },
  checkboxChecked: { backgroundColor: '#31513a', borderColor: '#31513a' },
  checkmark: { color: '#fff', fontSize: 16, fontWeight: '900' },
  itemCopy: { flex: 1 },
  itemName: { color: '#243027', fontSize: 16, fontWeight: '700' },
  itemNamePurchased: { textDecorationLine: 'line-through' },
  quantity: { color: '#737a74', fontSize: 12, marginTop: 3 },
  removeButton: { paddingHorizontal: 4, paddingVertical: 10 },
  removeText: { color: '#8c4a45', fontSize: 12, fontWeight: '700' },
  emptyCard: { backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 20, padding: 22 },
  emptyTitle: { color: '#243027', fontSize: 18, fontWeight: '800' },
  emptyText: { color: '#737a74', fontSize: 14, lineHeight: 21, marginTop: 6 },
  footer: { color: '#868b86', fontSize: 12, lineHeight: 18, marginTop: 26 },
  pressed: { opacity: 0.68 },
});
