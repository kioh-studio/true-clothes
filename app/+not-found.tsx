import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { T, type } from '../src/design/tokens';
import { useTranslation } from '../src/i18n';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('notFound_title') }} />
      <View style={styles.container}>
        <Text style={styles.text}>{t('notFound_message')}</Text>
        <Link href="/(onboarding)">
          <Text style={styles.link}>{t('notFound_goHome')}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.color.canvas },
  text: { ...type.body, color: T.color.primary },
  link: { ...type.ui, color: T.color.primary, textDecorationLine: 'underline', marginTop: 16 },
});
