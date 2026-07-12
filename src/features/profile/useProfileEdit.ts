import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../i18n';

interface ProfileEditState {
  displayName: string;
  gender: string;
  dob: string;
}

export function useProfileEdit() {
  const { t } = useTranslation();
  // Per-field selectors (not a full-store destructure): the store is written
  // to from many unrelated screens, and a full-store subscription would
  // re-render this whole edit screen on every one of those writes.
  const storedName   = useAuthStore(s => s.displayName);
  const storedGender = useAuthStore(s => s.gender);
  const storedDob    = useAuthStore(s => s.dob);
  const updateProfile = useAuthStore(s => s.updateProfile);
  const uploadAvatar  = useAuthStore(s => s.uploadAvatar);

  const [displayName, setDisplayName] = useState(storedName);
  const [gender, setGender] = useState(storedGender);
  const [dob, setDob] = useState(storedDob);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    displayName !== storedName ||
    gender !== storedGender ||
    dob !== storedDob;

  const save = useCallback(async (): Promise<boolean> => {
    if (!isDirty || saving) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await updateProfile({ displayName, gender, dob });
      if (!res.ok) {
        setError(res.message ?? t('addItem_errorMessage'));
        return false;
      }
      return true;
    } catch {
      setError(t('addItem_errorMessage'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [isDirty, saving, displayName, gender, dob, updateProfile, t]);

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
      setError(t('profileEdit_photoUploadError'));
    } finally {
      setSaving(false);
    }
  }, [uploadAvatar, t]);

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
