import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type ProfileAvatarProps = {
  name: string;
  uri?: string | null;
  size?: number;
  borderColor?: string;
};

function getInitials(name: string) {
  const [first = '', second = ''] = name.trim().split(/\s+/);
  return `${first.slice(0, 1)}${second.slice(0, 1)}`.toUpperCase() || '?';
}

export function ProfileAvatar({
  name,
  uri,
  size = 72,
  borderColor,
}: ProfileAvatarProps) {
  const accentSurface = useThemeColor({}, 'accentSurface');
  const textColor = useThemeColor({}, 'text');
  const defaultBorderColor = useThemeColor({}, 'border');
  const frameBorderColor = borderColor ?? defaultBorderColor;

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: frameBorderColor,
          backgroundColor: accentSurface,
        },
      ]}>
      {uri ? (
        <Image source={{ uri }} contentFit="cover" style={styles.image} />
      ) : (
        <ThemedText
          type="defaultSemiBold"
          style={[styles.initials, { color: textColor, fontSize: Math.max(18, size * 0.28) }]}>
          {getInitials(name)}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  image: {
    position: 'absolute',
    inset: 0,
  },
  initials: {
    lineHeight: 24,
  },
});
