import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

export function ScreenScroll({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const mutedTextColor = useThemeColor({}, 'mutedText');

  return (
    <ThemedView style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title">{title}</ThemedText>
            <ThemedText style={{ color: mutedTextColor }}>{description}</ThemedText>
          </View>
          {children}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

export function SectionCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const borderColor = useThemeColor({}, 'border');
  const surfaceColor = useThemeColor({}, 'surface');

  return (
    <ThemedView style={[styles.card, { borderColor, backgroundColor: surfaceColor }, style]}>
      {children}
    </ThemedView>
  );
}

export function ActionButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  testID?: string;
}) {
  const accentColor = useThemeColor({}, 'accent');
  const borderColor = useThemeColor({}, 'border');

  const backgroundColor =
    variant === 'primary' ? accentColor : variant === 'danger' ? '#8A1C1C' : 'transparent';
  const textColor = variant === 'secondary' ? undefined : '#FFFFFF';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}>
      <ThemedText
        type="defaultSemiBold"
        style={textColor ? { color: textColor } : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function InlineMessage({
  tone,
  message,
  testID,
}: {
  tone: 'error' | 'success' | 'muted';
  message: string;
  testID?: string;
}) {
  const themeBorderColor = useThemeColor({}, 'border');
  const themeSurfaceColor = useThemeColor({}, 'surface');
  const themeMutedTextColor = useThemeColor({}, 'mutedText');
  const borderColor = tone === 'error' ? '#F1A7A7' : tone === 'success' ? '#9DD0AE' : themeBorderColor;
  const backgroundColor =
    tone === 'error' ? '#FDECEC' : tone === 'success' ? '#E8F6EE' : themeSurfaceColor;
  const textColor =
    tone === 'error' ? '#8A1C1C' : tone === 'success' ? '#0F5132' : themeMutedTextColor;

  return (
    <View style={[styles.message, { borderColor, backgroundColor }]}>
      <ThemedText style={{ color: textColor }} testID={testID}>
        {message}
      </ThemedText>
    </View>
  );
}

export function StatPill({ label, value }: { label: string; value: number | string }) {
  const accentSurface = useThemeColor({}, 'accentSurface');
  const accentColor = useThemeColor({}, 'accent');

  return (
    <View style={[styles.statPill, { backgroundColor: accentSurface }]}>
      <ThemedText type="defaultSemiBold" style={{ color: accentColor }}>
        {value}
      </ThemedText>
      <ThemedText style={{ color: accentColor }}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  card: {
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  button: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'flex-start',
  },
});
