import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { reminderDateFromNow, scheduleReminder } from '../core/notifications/local-reminders';

const choices = [1, 5, 15] as const;

export default function ReminderScreen() {
  const [message, setMessage] = useState('Choose when to be reminded.');

  async function schedule(minutes: number) {
    try {
      await scheduleReminder({
        title: 'Reminder',
        body: 'Your timer is complete.',
        date: reminderDateFromNow(minutes),
      });
      setMessage(`Reminder scheduled for ${minutes} minute${minutes === 1 ? '' : 's'} from now.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not schedule the reminder.');
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Reminder' }} />
      <Text style={styles.title}>Local reminder</Text>
      <Text style={styles.body}>{message}</Text>
      <View style={styles.actions}>
        {choices.map((minutes) => (
          <Pressable key={minutes} onPress={() => schedule(minutes)} style={styles.button}>
            <Text style={styles.buttonText}>{minutes} min</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 18, padding: 24, backgroundColor: '#f7f7f2' },
  title: { color: '#14231f', fontSize: 34, fontWeight: '800' },
  body: { color: '#52605b', fontSize: 17, lineHeight: 25 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 13, backgroundColor: '#24765e' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
