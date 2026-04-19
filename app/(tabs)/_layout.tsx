import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  const { activeBusiness } = useBusiness();
  const { colors } = useTheme();
  const mode = activeBusiness?.mode ?? 'business';
  const showModeTab = mode === 'freelancer' || mode === 'personal';
  const modeTabTitle = mode === 'freelancer' ? 'Freelancer' : 'Personal';
  const modeTabEmoji = mode === 'freelancer' ? '🧳' : '🏠';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          paddingBottom: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerStyle: { backgroundColor: colors.header },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions', tabBarIcon: ({ focused }) => <TabIcon emoji="💳" focused={focused} /> }} />
      <Tabs.Screen name="invoices" options={{ title: 'Invoices', tabBarIcon: ({ focused }) => <TabIcon emoji="🧾" focused={focused} /> }} />
      <Tabs.Screen name="banks" options={{ title: 'Banks', tabBarIcon: ({ focused }) => <TabIcon emoji="🏦" focused={focused} /> }} />
      <Tabs.Screen
        name="mode"
        options={{
          title: modeTabTitle,
          href: showModeTab ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon emoji={modeTabEmoji} focused={focused} />,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} /> }} />
    </Tabs>
  );
}
