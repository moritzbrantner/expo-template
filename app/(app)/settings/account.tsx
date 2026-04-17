import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import {
  AvatarEditorModal,
  type AvatarCropSelection,
  type EditableAvatarAsset,
} from '@/components/avatar-editor-modal';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ActionButton, InlineMessage, ScreenScroll, SectionCard } from '@/components/social/ui';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useThemeMode } from '@/hooks/theme-mode';
import { useProfileQuery } from '@/lib/social-hooks';
import { useAuth } from '@/providers/auth-provider';

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
const AVATAR_SIZE = 92;
const AVATAR_OUTPUT_SIZE = 512;

export default function AccountSettingsScreen() {
  const borderColor = useThemeColor({}, 'border');
  const mutedTextColor = useThemeColor({}, 'mutedText');
  const palette = Colors[useThemeMode().activeTheme];
  const { currentUser, updateProfile, updateProfilePicture } = useAuth();
  const profileQuery = useProfileQuery(currentUser?.username);
  const profile = profileQuery.data?.profile;
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [editingAsset, setEditingAsset] = useState<EditableAvatarAsset | null>(null);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setDisplayName(profile.displayName);
    setUsername(profile.username);
    setBio(profile.bio);
  }, [profile]);

  async function handlePickProfilePicture() {
    if (isPickingPhoto || isUploadingPhoto) {
      return;
    }

    setError(null);
    setMessage(null);
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
        setError('The selected image did not include dimensions that can be cropped.');
        return;
      }

      setEditingAsset({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
    } catch (pickerError) {
      setError(pickerError instanceof Error ? pickerError.message : 'Unable to open the photo library.');
    } finally {
      setIsPickingPhoto(false);
    }
  }

  async function handleSaveAvatar(selection: AvatarCropSelection) {
    setError(null);
    setMessage(null);
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
      setMessage('Profile picture updated.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload the profile picture.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleRemoveProfilePicture() {
    if (!profile?.avatarUrl || isUploadingPhoto) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsUploadingPhoto(true);

    try {
      await updateProfilePicture(null);
      setMessage('Profile picture removed.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to remove the profile picture.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleSaveProfile() {
    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }

    if (!USERNAME_PATTERN.test(username.trim())) {
      setError('Username must be 3-24 characters using lowercase letters, numbers, or underscores.');
      return;
    }

    if (bio.trim().length > 280) {
      setError('Bio must be 280 characters or fewer.');
      return;
    }

    setError(null);
    setMessage(null);
    setIsSavingProfile(true);

    try {
      await updateProfile({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
      });
      setMessage('Profile updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update your profile.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <ScreenScroll
      title="Account"
      description="Edit the public fields that power `/u/[username]`, plus the avatar used across discover and profile views.">
      {profileQuery.isPending ? (
        <InlineMessage tone="muted" message="Loading your profile..." />
      ) : profileQuery.isError ? (
        <InlineMessage
          tone="error"
          message={profileQuery.error instanceof Error ? profileQuery.error.message : 'Unable to load your account.'}
        />
      ) : !profile ? (
        <InlineMessage tone="muted" message="Your account profile is not available." />
      ) : (
        <>
          <SectionCard>
            <ThemedText type="subtitle">Profile picture</ThemedText>
            <View style={styles.profileRow}>
              <ProfileAvatar
                name={profile.displayName}
                uri={profile.avatarUrl}
                size={AVATAR_SIZE}
                borderColor={borderColor}
              />
              <View style={styles.profileCopy}>
                <ThemedText type="defaultSemiBold">{profile.displayName}</ThemedText>
                <ThemedText style={{ color: mutedTextColor }}>@{profile.username}</ThemedText>
              </View>
            </View>
            <ActionButton
              label={isPickingPhoto ? 'Opening library...' : profile.avatarUrl ? 'Replace picture' : 'Choose picture'}
              onPress={() => void handlePickProfilePicture()}
              disabled={isPickingPhoto || isUploadingPhoto}
            />
            <ActionButton
              label="Remove picture"
              onPress={() => void handleRemoveProfilePicture()}
              disabled={!profile.avatarUrl || isUploadingPhoto}
              variant="secondary"
            />
          </SectionCard>

          <SectionCard>
            <ThemedText type="subtitle">Public profile</ThemedText>
            <View style={styles.field}>
              <ThemedText type="defaultSemiBold">Display name</ThemedText>
              <TextInput
                placeholder="Display name"
                placeholderTextColor={palette.mutedText}
                style={[styles.input, { borderColor, backgroundColor: palette.background, color: palette.text }]}
                testID="account-display-name-input"
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>
            <View style={styles.field}>
              <ThemedText type="defaultSemiBold">Username</ThemedText>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="username"
                placeholderTextColor={palette.mutedText}
                style={[styles.input, { borderColor, backgroundColor: palette.background, color: palette.text }]}
                testID="account-username-input"
                value={username}
                onChangeText={(value) => setUsername(value.toLowerCase())}
              />
            </View>
            <View style={styles.field}>
              <ThemedText type="defaultSemiBold">Bio</ThemedText>
              <TextInput
                multiline
                placeholder="Tell people what you are into."
                placeholderTextColor={palette.mutedText}
                style={[
                  styles.input,
                  styles.textarea,
                  { borderColor, backgroundColor: palette.background, color: palette.text },
                ]}
                testID="account-bio-input"
                value={bio}
                onChangeText={setBio}
              />
            </View>
            <ActionButton
              label={isSavingProfile ? 'Saving profile...' : 'Save profile'}
              onPress={() => void handleSaveProfile()}
              disabled={isSavingProfile}
              testID="account-save-button"
            />
            <ThemedText style={{ color: mutedTextColor }}>{currentUser?.email}</ThemedText>
          </SectionCard>

          {error ? <InlineMessage tone="error" message={error} /> : null}
          {message ? <InlineMessage tone="success" message={message} /> : null}
        </>
      )}

      <AvatarEditorModal
        visible={Boolean(editingAsset)}
        asset={editingAsset}
        isSaving={isUploadingPhoto}
        onCancel={() => {
          if (!isUploadingPhoto) {
            setEditingAsset(null);
          }
        }}
        onSave={(selection) => void handleSaveAvatar(selection)}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
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
  textarea: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
});
