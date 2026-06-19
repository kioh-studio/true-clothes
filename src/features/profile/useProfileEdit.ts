import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../stores/authStore';

interface ProfileEditState {
  displayName: string;
  gender: string;
  dob: string;
}

export function useProfileEdit() {
  const { displayName: storedName, gender: storedGender, dob: storedDob, updateProfile, uploadAvatar } = useAuthStore();

  const [displayName, setDisplayName] = useState(storedName);
  const [gender, setGender] = useState(storedGender);
  const [dob, setDob] = useState(storedDob);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    displayName !== storedName ||
    gender !== storedGender ||
    dob !== storedDob;

  const save = useCallback(async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await updateProfile({ displayName, gender, dob });
      if (!res.ok) setError(res.message ?? 'Failed to save. Please try again.');
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [isDirty, saving, displayName, gender, dob, updateProfile]);

  const pickAvatar = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    setSaving(true);
    setError(null);
    try {
      await uploadAvatar(result.assets[0].uri);
    } catch {
      setError('Failed to upload photo. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [uploadAvatar]);

  return {
    displayName, setDisplayName,
    gender, setGender,
    dob, setDob,
    isDirty,
    saving,
    error,
    save,
    pickAvatar,
  };
}
