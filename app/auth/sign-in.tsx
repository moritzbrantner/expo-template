import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/auth-provider';
import { useThemeMode } from '@/hooks/theme-mode';
import { Colors } from '@/constants/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignIn(email: string, password: string) {
  if (!email.trim()) {
    return 'Email is required.';
  }

  if (!EMAIL_PATTERN.test(email.trim())) {
    return 'Enter a valid email address.';
  }

  if (!password) {
    return 'Password is required.';
  }

  return null;
}

export default function SignInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; registered?: string }>();
  const { currentUser, isHydrating, signIn } = useAuth();
  const { activeTheme } = useThemeMode();
  const palette = Colors[activeTheme];
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(
    params.registered === '1' ? 'Account created. Sign in to continue.' : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof params.email === 'string') {
      setEmail(params.email);
    }
  }, [params.email]);

  useEffect(() => {
    if (!isHydrating && currentUser) {
      router.replace('/');
    }
  }, [currentUser, isHydrating, router]);

  async function handleSubmit() {
    setSuccess(null);

    const validationError = validateSignIn(email, password);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await signIn({ email: email.trim(), password });
      router.replace('/');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your account"
      description="Use the credentials you created during signup to access the app."
      footerPrompt="Need an account?"
      footerLabel="Create one"
      footerHref="/auth/sign-up">
      {isHydrating ? (
        <View style={styles.form}>
          <ThemedText testID="signin-hydrating-message">Restoring your session...</ThemedText>
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.field}>
            <ThemedText type="defaultSemiBold">Email</ThemedText>
            <TextInput
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={palette.mutedText}
              style={[
                styles.input,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.background,
                  color: palette.text,
                },
              ]}
              testID="signin-email-input"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={styles.field}>
            <ThemedText type="defaultSemiBold">Password</ThemedText>
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete="current-password"
              placeholder="Your password"
              placeholderTextColor={palette.mutedText}
              secureTextEntry
              style={[
                styles.input,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.background,
                  color: palette.text,
                },
              ]}
              testID="signin-password-input"
              value={password}
              onChangeText={setPassword}
            />
          </View>
          {error ? (
            <View
              style={[
                styles.message,
                { backgroundColor: '#FDECEC', borderColor: '#F1A7A7' },
              ]}>
              <ThemedText style={{ color: '#8A1C1C' }} testID="signin-error-message">
                {error}
              </ThemedText>
            </View>
          ) : null}
          {success ? (
            <View
              style={[
                styles.message,
                { backgroundColor: '#E8F6EE', borderColor: '#9DD0AE' },
              ]}>
              <ThemedText style={{ color: '#0F5132' }} testID="signin-success-message">
                {success}
              </ThemedText>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            style={[
              styles.button,
              {
                backgroundColor: isSubmitting ? palette.icon : palette.accent,
              },
            ]}
            testID="signin-submit-button"
            onPress={handleSubmit}>
            <ThemedText style={styles.buttonLabel}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            style={styles.secondaryLink}
            onPress={() => router.push('/auth/sign-up')}>
            <ThemedText type="link">Create an account instead</ThemedText>
          </Pressable>
        </View>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  message: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryLink: {
    alignSelf: 'flex-start',
  },
});
