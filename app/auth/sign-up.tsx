import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/hooks/theme-mode';
import { useAuth } from '@/providers/auth-provider';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignUp(name: string, email: string, password: string, confirmPassword: string) {
  if (!name.trim()) {
    return 'Name is required.';
  }

  if (!email.trim()) {
    return 'Email is required.';
  }

  if (!EMAIL_PATTERN.test(email.trim())) {
    return 'Enter a valid email address.';
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }

  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }

  return null;
}

export default function SignUpScreen() {
  const router = useRouter();
  const { currentUser, isHydrating, signUp } = useAuth();
  const { activeTheme } = useThemeMode();
  const palette = Colors[activeTheme];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isHydrating && currentUser) {
      router.replace('/');
    }
  }, [currentUser, isHydrating, router]);

  async function handleSubmit() {
    const validationError = validateSignUp(name, email, password, confirmPassword);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      router.replace({
        pathname: '/auth/sign-in',
        params: {
          email: email.trim(),
          registered: '1',
        },
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign up.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="New account"
      title="Create your workspace access"
      description="Sign up with a work email. A welcome email is sent through the local Mailpit inbox for testing."
      footerPrompt="Already have an account?"
      footerLabel="Sign in"
      footerHref="/auth/sign-in">
      {isHydrating ? (
        <View style={styles.form}>
          <ThemedText testID="signup-hydrating-message">Restoring your session...</ThemedText>
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.field}>
            <ThemedText type="defaultSemiBold">Name</ThemedText>
            <TextInput
              accessibilityLabel="Name"
              autoCapitalize="words"
              autoComplete="name"
              placeholder="Ada Lovelace"
              placeholderTextColor={palette.mutedText}
              style={[
                styles.input,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.background,
                  color: palette.text,
                },
              ]}
              testID="signup-name-input"
              value={name}
              onChangeText={setName}
            />
          </View>
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
              testID="signup-email-input"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={styles.field}>
            <ThemedText type="defaultSemiBold">Password</ThemedText>
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="At least 8 characters"
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
              testID="signup-password-input"
              value={password}
              onChangeText={setPassword}
            />
          </View>
          <View style={styles.field}>
            <ThemedText type="defaultSemiBold">Confirm password</ThemedText>
            <TextInput
              accessibilityLabel="Confirm password"
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="Repeat your password"
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
              testID="signup-confirm-password-input"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>
          {error ? (
            <View
              style={[
                styles.message,
                { backgroundColor: '#FDECEC', borderColor: '#F1A7A7' },
              ]}>
              <ThemedText style={{ color: '#8A1C1C' }} testID="signup-error-message">
                {error}
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
            testID="signup-submit-button"
            onPress={handleSubmit}>
            <ThemedText style={styles.buttonLabel}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </ThemedText>
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
});
