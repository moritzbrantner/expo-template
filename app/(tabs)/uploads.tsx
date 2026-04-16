import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function UploadsScreen() {
  return (
    <ThemedView style={styles.screen}>
      <ThemedText type="title">Uploads</ThemedText>
      <ThemedText>
        This tab is reserved for upload workflows. The auth flow lives on the dedicated signin and
        signup routes.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: 12,
    padding: 20,
  },
});
