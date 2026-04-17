import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/hooks/theme-mode';
import { useAuth } from '@/providers/auth-provider';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

function validateSignUp(
  displayName: string,
  username: string,
  email: string,
  password: string,
  confirmPassword: string,
) {
  if (!displayName.trim()) {
    return 'Display name is required.';
  }

  if (!USERNAME_PATTERN.test(username.trim())) {
    return 'Username must be 3-24 characters using lowercase letters, numbers, or underscores.';
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
  const { activeTheme } = useThemeMode();
  const { signUp } = useAuth();
  const palette = Colors[activeTheme];
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const validationError = validateSignUp(displayName, username, email, password, confirmPassword);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await signUp({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
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
      title="Create your public profile"
      description="Choose the username that will power public profile routes, follow actions, and discovery."
      footerPrompt="Already have an account?"
      footerLabel="Sign in"
      footerHref="/auth/sign-in">
      <View style={styles.form}>
        <View style={styles.field}>
          <ThemedText type="defaultSemiBold">Display name</ThemedText>
          <TextInput
            accessibilityLabel="Display name"
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
            testID="signup-display-name-input"
            value={displayName}
            onChangeText={setDisplayName}
          />
        </View>
        <View style={styles.field}>
          <ThemedText type="defaultSemiBold">Username</ThemedText>
          <TextInput
            accessibilityLabel="Username"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ada"
            placeholderTextColor={palette.mutedText}
            style={[
              styles.input,
              {
                borderColor: palette.border,
                backgroundColor: palette.background,
                color: palette.text,
              },
            ]}
            testID="signup-username-input"
            value={username}
            onChangeText={(value) => setUsername(value.toLowerCase())}
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
          <View style={[styles.message, { backgroundColor: '#FDECEC', borderColor: '#F1A7A7' }]}>
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
          onPress={() => void handleSubmit()}>
          <ThemedText style={styles.buttonLabel}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </ThemedText>
        </Pressable>
      </View>
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
