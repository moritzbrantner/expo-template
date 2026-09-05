import * as Haptics from 'expo-haptics';

export type SemanticHaptic = 'tick' | 'snap' | 'boundary' | 'success' | 'warning' | 'reject';

export async function triggerSemanticHaptic(kind: SemanticHaptic, enabled = true) {
  if (!enabled) {
    return;
  }

  try {
    switch (kind) {
      case 'tick':
        await Haptics.selectionAsync();
        return;
      case 'snap':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      case 'boundary':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      case 'reject':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
    }
  } catch {
    // Haptics are an enhancement. Unsupported devices must not block the interaction.
  }
}
