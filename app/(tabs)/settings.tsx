import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AvatarEditorModal,
  type AvatarCropSelection,
  type EditableAvatarAsset,
} from '@/components/avatar-editor-modal';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ThemeModeToggle } from '@/components/theme-mode-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useThemeMode } from '@/hooks/theme-mode';
import { useAuth } from '@/providers/auth-provider';

const AVATAR_SIZE = 92;
const AVATAR_OUTPUT_SIZE = 512;

export default function SettingsScreen() {
  const borderColor = useThemeColor({}, 'border');
  const mutedTextColor = useThemeColor({}, 'mutedText');
  const accentColor = useThemeColor({}, 'accent');
  const accentSurface = useThemeColor({}, 'accentSurface');
  const palette = Colors[useThemeMode().activeTheme];
  const { currentUser, signOut, updateProfilePicture } = useAuth();
  const [editingAsset, setEditingAsset] = useState<EditableAvatarAsset | null>(null);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);

  async function handlePickProfilePicture() {
    if (!currentUser || isPickingPhoto || isUploadingPhoto) {
      return;
    }

    setAvatarError(null);
    setAvatarMessage(null);
    setIsPickingPhoto(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsMultipleSelection: false,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];

      if (!asset.width || !asset.height) {
        setAvatarError('The selected image did not include dimensions that can be cropped.');
        return;
      }

      setEditingAsset({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Unable to open the photo library.');
    } finally {
      setIsPickingPhoto(false);
    }
  }

  async function handleSaveAvatar(selection: AvatarCropSelection) {
    if (!currentUser) {
      return;
    }

    setAvatarError(null);
    setAvatarMessage(null);
    setIsUploadingPhoto(true);

    try {
      const croppedImage = await manipulateAsync(
        selection.asset.uri,
        [
          { crop: selection.crop },
          {
            resize: {
              width: AVATAR_OUTPUT_SIZE,
              height: AVATAR_OUTPUT_SIZE,
            },
          },
        ],
        {
          compress: 0.82,
          format: SaveFormat.JPEG,
          base64: true,
        },
      );

      if (!croppedImage.base64) {
        throw new Error('Unable to prepare the cropped image for upload.');
      }

      await updateProfilePicture(`data:image/jpeg;base64,${croppedImage.base64}`);
      setEditingAsset(null);
      setAvatarMessage('Profile picture updated.');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Unable to upload the profile picture.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleRemoveProfilePicture() {
    if (!currentUser || !currentUser.avatarUrl || isUploadingPhoto) {
      return;
    }

    setAvatarError(null);
    setAvatarMessage(null);
    setIsUploadingPhoto(true);

    try {
      await updateProfilePicture(null);
      setAvatarMessage('Profile picture removed.');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Unable to remove the profile picture.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  return (
    <ThemedView style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="title">Settings</ThemedText>
            <ThemedText>
              Adjust account preferences, including the avatar shown across your public profile.
            </ThemedText>
          </ThemedView>

          <ThemedView
            style={[styles.card, { borderColor }]}
            lightColor={Colors.light.surface}
            darkColor={Colors.dark.surface}>
            <ThemedText type="subtitle">Profile picture</ThemedText>

            {currentUser ? (
              <>
                <View style={styles.profileRow}>
                  <ProfileAvatar
                    name={currentUser.name}
                    uri={currentUser.avatarUrl}
                    size={AVATAR_SIZE}
                    borderColor={borderColor}
                  />
                  <View style={styles.profileCopy}>
                    <ThemedText type="defaultSemiBold">{currentUser.name}</ThemedText>
                    <ThemedText style={{ color: mutedTextColor }}>{currentUser.email}</ThemedText>
                    <View style={[styles.statusPill, { backgroundColor: accentSurface }]}>
                      <ThemedText style={[styles.statusPillLabel, { color: accentColor }]}>
                        Drag, crop, and upload a square avatar
                      </ThemedText>
                    </View>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isPickingPhoto || isUploadingPhoto}
                    onPress={() => void handlePickProfilePicture()}
                    style={({ pressed }) => [
                      styles.primaryAction,
                      {
                        backgroundColor:
                          isPickingPhoto || isUploadingPhoto ? palette.icon : accentColor,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}>
                    <ThemedText style={styles.primaryActionLabel}>
                      {isPickingPhoto
                        ? 'Opening library...'
                        : currentUser.avatarUrl
                          ? 'Replace picture'
                          : 'Choose picture'}
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    disabled={!currentUser.avatarUrl || isUploadingPhoto}
                    onPress={() => void handleRemoveProfilePicture()}
                    style={({ pressed }) => [
                      styles.secondaryAction,
                      {
                        borderColor,
                        opacity: !currentUser.avatarUrl || isUploadingPhoto ? 0.45 : pressed ? 0.82 : 1,
                      },
                    ]}>
                    <ThemedText type="defaultSemiBold">Remove</ThemedText>
                  </Pressable>
                </View>

                <ThemedText style={[styles.hint, { color: mutedTextColor }]}>
                  After you pick an image, you can drag and zoom it before the cropped version is
                  uploaded.
                </ThemedText>

                {avatarError ? (
                  <View
                    style={[
                      styles.feedback,
                      {
                        backgroundColor: '#FDECEC',
                        borderColor: '#F1A7A7',
                      },
                    ]}>
                    <ThemedText style={{ color: '#8A1C1C' }}>{avatarError}</ThemedText>
                  </View>
                ) : null}

                {avatarMessage ? (
                  <View
                    style={[
                      styles.feedback,
                      {
                        backgroundColor: '#E8F6EE',
                        borderColor: '#9DD0AE',
                      },
                    ]}>
                    <ThemedText style={{ color: '#0F5132' }}>{avatarMessage}</ThemedText>
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  onPress={signOut}
                  style={({ pressed }) => [
                    styles.signOutButton,
                    { borderColor, opacity: pressed ? 0.82 : 1 },
                  ]}>
                  <ThemedText type="defaultSemiBold">Sign out</ThemedText>
                </Pressable>
              </>
            ) : (
              <>
                <ThemedText style={{ color: mutedTextColor }}>
                  Sign in to pick, crop, and upload a profile picture.
                </ThemedText>
                <View style={styles.authLinks}>
                  <Link href="/auth/sign-in" asChild>
                    <Pressable style={[styles.secondaryAction, { borderColor }]}>
                      <ThemedText type="defaultSemiBold">Sign in</ThemedText>
                    </Pressable>
                  </Link>
                  <Link href="/auth/sign-up" asChild>
                    <Pressable style={[styles.secondaryAction, { borderColor }]}>
                      <ThemedText type="defaultSemiBold">Create account</ThemedText>
                    </Pressable>
                  </Link>
                </View>
              </>
            )}
          </ThemedView>

          <ThemedView
            style={[styles.card, { borderColor }]}
            lightColor={Colors.light.surface}
            darkColor={Colors.dark.surface}>
            <ThemeModeToggle />
            <ThemedText style={[styles.hint, { color: mutedTextColor }]}>
              Theme changes are applied immediately and saved across reloads.
            </ThemedText>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      <AvatarEditorModal
        asset={editingAsset}
        visible={editingAsset !== null}
        isSaving={isUploadingPhoto}
        onCancel={() => {
          if (!isUploadingPhoto) {
            setEditingAsset(null);
          }
        }}
        onSave={(selection) => void handleSaveAvatar(selection)}
      />
    </ThemedView>
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
    paddingBottom: 32,
    gap: 20,
  },
  header: {
    gap: 10,
  },
  card: {
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileCopy: {
    flex: 1,
    gap: 6,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryActionLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryAction: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  hint: {
    lineHeight: 22,
  },
  feedback: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  signOutButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  authLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
