import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { T, type } from '../src/design/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.text}>Screen not found.</Text>
        <Link href="/(onboarding)">
          <Text style={styles.link}>Go home</Text>
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
