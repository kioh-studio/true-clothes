import { Tabs } from 'expo-router';
import { T } from '../../src/design/tokens';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="wardrobe" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
