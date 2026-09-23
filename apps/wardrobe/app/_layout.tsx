import { Tabs } from 'expo-router';

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Wardrobe' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="outfits" options={{ title: 'Outfits' }} />
    </Tabs>
  );
}
