// Settings screen — T024 (US8)
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { IconChevronLeft } from '../src/components/icons';
import { useAuthStore } from '../src/stores/authStore';
import { useAppStore } from '../src/stores/appStore';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout, deleteAccount } = useAuthStore();
  const { unitPreference } = useAppStore();

  const [units, setUnits] = useState<'metric' | 'imperial'>(unitPreference);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleUnitToggle = (val: boolean) => {
    const next: 'metric' | 'imperial' = val ? 'imperial' : 'metric';
    setUnits(next);
    useAppStore.setState({ unitPreference: next });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your profile, wardrobe, and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ],
    );
  };

  const confirmDelete = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      router.replace('/(onboarding)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete account. Please try again.';
      setDeleteError(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Text style={styles.navTitle}>Settings</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Units</Text>
              <Text style={styles.rowDesc}>{units === 'metric' ? 'Metric (cm, kg)' : 'Imperial (in, lb)'}</Text>
            </View>
            <Switch
              value={units === 'imperial'}
              onValueChange={handleUnitToggle}
              trackColor={{ false: T.color.muted, true: T.color.primary }}
              thumbColor={T.color.canvas}
            />
          </View>
        </View>

        {/* Account */}
        <Text style={[styles.sectionLabel, { marginTop: 32 }]}>ACCOUNT</Text>
        <View style={styles.section}>
          <Pressable style={styles.row} onPress={() => logout().then(() => router.replace('/(onboarding)'))}>
            <Text style={styles.rowTitle}>Sign out</Text>
          </Pressable>
        </View>

        {/* Danger Zone */}
        <Text style={[styles.sectionLabel, { marginTop: 32 }]}>DANGER ZONE</Text>
        <View style={styles.section}>
          <Pressable style={[styles.row, styles.dangerRow]} onPress={handleDeleteAccount} disabled={deleteLoading}>
            {deleteLoading ? (
              <ActivityIndicator size="small" color={T.color.error} />
            ) : (
              <Text style={styles.dangerText}>Delete Account</Text>
            )}
          </Pressable>
          {deleteError && (
            <Text style={styles.errorText}>{deleteError}</Text>
          )}
        </View>

        {/* App Info */}
        <Text style={[styles.sectionLabel, { marginTop: 32 }]}>APP</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Version</Text>
            <Text style={styles.rowDesc}>{APP_VERSION}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: {
    fontFamily: T.font.serif,
    fontSize: 17,
    fontWeight: '400',
    color: T.color.primary,
  },
  content: { paddingHorizontal: 24, paddingTop: 32 },
  sectionLabel: {
    ...type.ui,
    fontSize: 10,
    color: T.color.tertiary,
    marginBottom: 8,
  },
  section: {
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
    gap: 12,
  },
  rowBody: { flex: 1 },
  rowTitle: {
    fontFamily: T.font.serif,
    fontSize: 17,
    fontWeight: '400',
    color: T.color.primary,
  },
  rowDesc: {
    ...type.caption,
    fontSize: 12,
    color: T.color.tertiary,
    marginTop: 2,
  },
  dangerRow: { borderColor: T.color.hairline },
  dangerText: {
    fontFamily: T.font.serif,
    fontSize: 17,
    fontWeight: '400',
    color: T.color.error,
  },
  errorText: {
    ...type.caption,
    color: T.color.error,
    paddingVertical: 8,
  },
});
