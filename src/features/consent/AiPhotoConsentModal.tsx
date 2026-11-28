// Mounted once in app/_layout.tsx; opens when consentStore.require() needs a decision.
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../design/tokens';
import { PrimaryButton, SecondaryButton, TextLink } from '../../components/ui';
import { useConsentStore } from '../../stores/consentStore';
import { PRIVACY_URL } from '../../config/legal';
import i18n, { useTranslation } from '../../i18n';

export function AiPhotoConsentHost() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const open = useConsentStore((s) => s.modalOpen);
  const submitting = useConsentStore((s) => s.submitting);
  const submitError = useConsentStore((s) => s.submitError);
  const accept = useConsentStore((s) => s.accept);
  const decline = useConsentStore((s) => s.decline);
  const [checked, setChecked] = useState(false);

  useEffect(() => { if (open) setChecked(false); }, [open]);

  const privacyUrl = i18n.language?.startsWith('vi')
    ? 'https://kiohtechnology.com/vi/products/mien/privacy'
    : PRIVACY_URL;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={decline}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <Text style={styles.title}>{t('consent_title')}</Text>
            <Text style={styles.text}>{t('consent_body')}</Text>
            <Pressable
              style={styles.checkRow}
              onPress={() => setChecked((c) => !c)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
            >
              <View style={styles.box}>{checked && <View style={styles.boxMark} />}</View>
              <Text style={styles.checkLabel}>{t('consent_checkbox')}</Text>
            </Pressable>
          </ScrollView>
          <View style={styles.actions}>
            {submitError && <Text style={styles.error}>{t('consent_error')}</Text>}
            <PrimaryButton disabled={!checked || submitting} onPress={accept}>
              {t('consent_agree')}
            </PrimaryButton>
            <SecondaryButton onPress={decline} disabled={submitting}>{t('consent_decline')}</SecondaryButton>
            <View style={styles.link}>
              <TextLink onPress={() => { void Linking.openURL(privacyUrl); }}>{t('consent_privacyLink')}</TextLink>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: T.color.sheetDim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.color.canvas,
    maxHeight: '92%',
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
  },
  body: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 16 },
  title: { ...type.h2, color: T.color.primary, fontFamily: T.font.serifLight, fontWeight: '300', marginBottom: 20 },
  text: { ...type.body, color: T.color.secondary, lineHeight: 22 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginTop: 28 },
  box: {
    width: 20, height: 20, borderWidth: 0.5, borderColor: T.color.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  boxMark: { width: 10, height: 10, backgroundColor: T.color.primary },
  checkLabel: { ...type.body, color: T.color.primary, flex: 1, lineHeight: 22 },
  actions: { paddingHorizontal: 24, gap: 12 },
  error: { ...type.caption, color: T.color.error },
  link: { alignItems: 'center', paddingTop: 8 },
});
