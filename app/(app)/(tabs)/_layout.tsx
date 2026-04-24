import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/hooks/theme-mode';
import { appTabDescriptors } from '@/lib/navigation';

export default function AppTabsLayout() {
  const { activeTheme } = useThemeMode();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors[activeTheme].tint,
        tabBarButton: HapticTab,
      }}>
      {appTabDescriptors.map((descriptor) => (
        <Tabs.Screen
          key={descriptor.name}
          name={descriptor.name}
          options={{
            title: descriptor.title,
            href: descriptor.href,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name={descriptor.iconName} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
