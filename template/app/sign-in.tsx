import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { createMockAuthAdapter } from '../core/auth/auth-contract';
import { writeSession } from '../core/auth/session-store';
import { usePreferences } from '../core/preferences/preferences-provider';

const auth = createMockAuthAdapter();

export default function SignInScreen() {
  const router = useRouter();
  const { t } = usePreferences();
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const session = await auth.signIn(email, password);
      await writeSession(session);
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('signIn') }} />
      <Text style={styles.title}>{t('signIn')}</Text>
      <TextInput
        accessibilityLabel={t('email')}
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder={t('email')}
        style={styles.input}
        value={email}
      />
      <TextInput
        accessibilityLabel={t('password')}
        onChangeText={setPassword}
        placeholder={t('password')}
        secureTextEntry
        style={styles.input}
        value={password}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={submitting} onPress={submit} style={styles.button}>
        <Text style={styles.buttonText}>{t('continue')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 14, padding: 24, backgroundColor: '#f7f7f2' },
  title: { marginBottom: 8, color: '#14231f', fontSize: 34, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#a9b3af', borderRadius: 12, padding: 14, backgroundColor: '#fff' },
  error: { color: '#a12828' },
  button: { alignItems: 'center', borderRadius: 12, padding: 15, backgroundColor: '#24765e' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
