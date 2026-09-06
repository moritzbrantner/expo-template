import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addEquipmentItem,
  deserializeEquipmentState,
  EQUIPMENT_STORAGE_KEY,
  equipmentItems,
  setEquipmentStatus,
  type EquipmentKind,
  type EquipmentState,
  type EquipmentStatus,
} from '../lib/equipment';

type EquipmentTrackerScreenProps = {
  kind: EquipmentKind;
  title: string;
  singularLabel: string;
  icon: string;
};

const STATUS_OPTIONS: Array<{ status: EquipmentStatus; label: string; icon: string }> = [
  { status: 'dirty', label: 'Dirty', icon: '●' },
  { status: 'washed', label: 'Washed', icon: '💧' },
  { status: 'sterilized', label: 'Sterilized', icon: '✨' },
];

function emptyState(): EquipmentState {
  return { items: [] };
}

export function EquipmentTrackerScreen({
  kind,
  title,
  singularLabel,
  icon,
}: EquipmentTrackerScreenProps) {
  const router = useRouter();
  const [state, setState] = useState<EquipmentState>(emptyState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(EQUIPMENT_STORAGE_KEY)
      .then((stored) => {
        if (active) setState(deserializeEquipmentState(stored));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const items = useMemo(() => equipmentItems(state, kind), [kind, state]);

  const persist = (next: EquipmentState) => {
    setState(next);
    void AsyncStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(next));
  };

  const addItem = () => {
    const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    persist(addEquipmentItem(state, { id, kind, updatedAt: Date.now() }));
  };

  const updateStatus = (id: string, status: EquipmentStatus) => {
    persist(setEquipmentStatus(state, id, status, Date.now()));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityLabel="Back to settings"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <View style={styles.titleRow}>
          <Text style={styles.titleIcon}>{icon}</Text>
          <Text style={styles.heading}>{title}</Text>
        </View>
        <Text style={styles.intro}>
          Track each {singularLabel.toLowerCase()} as dirty, washed, or sterilized.
        </Text>

        <Pressable
          accessibilityRole="button"
          disabled={!hydrated}
          onPress={addItem}
          style={({ pressed }) => [
            styles.addButton,
            !hydrated && styles.disabled,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.addButtonText}>＋ Add {singularLabel.toLowerCase()}</Text>
        </Pressable>

        {items.length === 0 ? (
          <Text style={styles.emptyText}>No {title.toLowerCase()} tracked yet.</Text>
        ) : (
          <View style={styles.list}>
            {items.map((item, index) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{singularLabel} {index + 1}</Text>
                  <Text style={styles.itemStatus}>{item.status}</Text>
                </View>
                <View style={styles.statusRow}>
                  {STATUS_OPTIONS.map((option) => {
                    const selected = item.status === option.status;
                    return (
                      <Pressable
                        key={option.status}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => updateStatus(item.id, option.status)}
                        style={({ pressed }) => [
                          styles.statusButton,
                          selected && styles.statusButtonSelected,
                          pressed && styles.pressed,
                        ]}>
                        <Text style={styles.statusIcon}>{option.icon}</Text>
                        <Text style={[styles.statusText, selected && styles.statusTextSelected]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f2ee' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12 },
  backText: { color: '#5f554f', fontSize: 14, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  titleIcon: { fontSize: 28 },
  heading: { color: '#332c29', fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  intro: { color: '#776d68', fontSize: 14, lineHeight: 21, marginTop: 8 },
  addButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#3f5b4d',
    borderRadius: 14,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  emptyText: { color: '#8e837d', fontSize: 13, marginTop: 24 },
  list: { gap: 12, marginTop: 20 },
  itemCard: {
    backgroundColor: '#fffdfb',
    borderColor: '#ded4ce',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  itemTitle: { color: '#3b322e', fontSize: 15, fontWeight: '800' },
  itemStatus: { color: '#847973', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  statusRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  statusButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderColor: '#d9cec8',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 6,
  },
  statusButtonSelected: { backgroundColor: '#684f5b', borderColor: '#684f5b' },
  statusIcon: { fontSize: 13 },
  statusText: { color: '#625852', fontSize: 11, fontWeight: '800' },
  statusTextSelected: { color: '#fff' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.66 },
});
