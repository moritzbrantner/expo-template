import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatTimeInput } from '../lib/feeding';

type PickerMode = 'date' | 'time';

type DateTimePickerModalProps = {
  mode: PickerMode;
  value: number;
  visible: boolean;
  onChange: (value: number) => void;
  onClose: () => void;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
const HOURS = Array.from({ length: 24 }, (_, index) => index);

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function calendarCells(month: Date): Array<Date | null> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<Date | null> = Array.from({ length: leading }, () => null);

  for (let day = 1; day <= days; day += 1) {
    cells.push(new Date(year, monthIndex, day));
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function PickerButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: selected ?? false }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pickerButton,
        selected && styles.pickerButtonSelected,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.pickerButtonText, selected && styles.pickerButtonTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function DateTimePickerModal({
  mode,
  value,
  visible,
  onChange,
  onClose,
}: DateTimePickerModalProps) {
  const [draft, setDraft] = useState(() => new Date(value));
  const [month, setMonth] = useState(() => {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  useEffect(() => {
    if (!visible) return;
    const date = new Date(value);
    setDraft(date);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [value, visible]);

  const cells = useMemo(() => calendarCells(month), [month]);
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month),
    [month],
  );

  const shiftMonth = (delta: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const selectDate = (selected: Date) => {
    setDraft((current) => {
      const next = new Date(current);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      return next;
    });
  };

  const selectHour = (hour: number) => {
    setDraft((current) => {
      const next = new Date(current);
      next.setHours(hour);
      return next;
    });
  };

  const selectMinute = (minute: number) => {
    setDraft((current) => {
      const next = new Date(current);
      next.setMinutes(minute, 0, 0);
      return next;
    });
  };

  const handleDone = () => {
    onChange(draft.getTime());
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.modalCard}>
          <Text style={styles.title}>{mode === 'date' ? 'Select date' : 'Select time'}</Text>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {mode === 'date' ? (
              <>
                <View style={styles.monthHeader}>
                  <Pressable
                    accessibilityLabel="Previous month"
                    accessibilityRole="button"
                    onPress={() => shiftMonth(-1)}
                    style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
                    <Text style={styles.monthButtonText}>‹</Text>
                  </Pressable>
                  <Text style={styles.monthLabel}>{monthLabel}</Text>
                  <Pressable
                    accessibilityLabel="Next month"
                    accessibilityRole="button"
                    onPress={() => shiftMonth(1)}
                    style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
                    <Text style={styles.monthButtonText}>›</Text>
                  </Pressable>
                </View>

                <View style={styles.weekRow}>
                  {WEEKDAYS.map((weekday) => (
                    <Text key={weekday} style={styles.weekday}>
                      {weekday}
                    </Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {cells.map((date, index) =>
                    date ? (
                      <Pressable
                        accessibilityLabel={new Intl.DateTimeFormat(undefined, {
                          dateStyle: 'full',
                        }).format(date)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: sameDay(date, draft) }}
                        key={date.toISOString()}
                        onPress={() => selectDate(date)}
                        style={({ pressed }) => [
                          styles.dayButton,
                          sameDay(date, draft) && styles.dayButtonSelected,
                          pressed && styles.pressed,
                        ]}>
                        <Text
                          style={[
                            styles.dayButtonText,
                            sameDay(date, draft) && styles.dayButtonTextSelected,
                          ]}>
                          {date.getDate()}
                        </Text>
                      </Pressable>
                    ) : (
                      <View key={`empty-${index}`} style={styles.dayButton} />
                    ),
                  )}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.timeValue}>{formatTimeInput(draft.getTime())}</Text>
                <Text style={styles.pickerLabel}>Hour</Text>
                <View style={styles.optionGrid}>
                  {HOURS.map((hour) => (
                    <PickerButton
                      key={hour}
                      label={String(hour).padStart(2, '0')}
                      onPress={() => selectHour(hour)}
                      selected={draft.getHours() === hour}
                    />
                  ))}
                </View>
                <Text style={styles.pickerLabel}>Minute</Text>
                <View style={styles.optionGrid}>
                  {MINUTES.map((minute) => (
                    <PickerButton
                      key={minute}
                      label={String(minute).padStart(2, '0')}
                      onPress={() => selectMinute(minute)}
                      selected={draft.getMinutes() === minute}
                    />
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleDone}
              style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(40, 34, 31, 0.42)',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    alignSelf: 'center',
    backgroundColor: '#fffdfb',
    borderRadius: 22,
    borderColor: '#ded4ce',
    borderWidth: 1,
    padding: 18,
  },
  title: { color: '#352d29', fontSize: 19, fontWeight: '800' },
  modalContent: { paddingTop: 14, paddingBottom: 6 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  monthButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#d9cec8',
    borderWidth: 1,
    borderRadius: 12,
  },
  monthButtonText: { color: '#4a403b', fontSize: 26, fontWeight: '700', lineHeight: 28 },
  monthLabel: { flex: 1, color: '#413733', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, color: '#8a7d76', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayButton: {
    width: '14.2857%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  dayButtonSelected: { backgroundColor: '#684f5b' },
  dayButtonText: { color: '#4c423d', fontSize: 14, fontWeight: '700' },
  dayButtonTextSelected: { color: '#fffaf7' },
  timeValue: {
    color: '#332c29',
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginBottom: 10,
  },
  pickerLabel: {
    color: '#786a63',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pickerButton: {
    width: '22.5%',
    minWidth: 58,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#d9cec8',
    borderWidth: 1,
    borderRadius: 11,
  },
  pickerButtonSelected: { backgroundColor: '#684f5b', borderColor: '#684f5b' },
  pickerButtonText: { color: '#5f554f', fontSize: 13, fontWeight: '700' },
  pickerButtonTextSelected: { color: '#fffaf7' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#d9cec8',
    borderWidth: 1,
    borderRadius: 13,
  },
  cancelText: { color: '#665b55', fontSize: 14, fontWeight: '800' },
  doneButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3f5b4d',
    borderRadius: 13,
  },
  doneText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.66 },
});
