import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';

function TabIcon({ emoji, focused, brandPrimary }: { emoji: string; focused: boolean; brandPrimary: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 4, paddingTop: 2 }}>
      <View style={{
        width: 24,
        height: 3,
        backgroundColor: focused ? brandPrimary : 'transparent',
        borderRadius: 1.5,
      }} />
      <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.5 }}>
        {emoji}
      </Text>
    </View>
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
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.inkSecondary,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          paddingBottom: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Manrope_600SemiBold',
          fontWeight: '600',
        },
        headerStyle: { backgroundColor: colors.header },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontFamily: 'Manrope_600SemiBold', fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} brandPrimary={colors.brandPrimary} /> }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions', tabBarIcon: ({ focused }) => <TabIcon emoji="💳" focused={focused} brandPrimary={colors.brandPrimary} /> }} />
      <Tabs.Screen name="invoices" options={{ title: 'Invoices', tabBarIcon: ({ focused }) => <TabIcon emoji="🧾" focused={focused} brandPrimary={colors.brandPrimary} /> }} />
      <Tabs.Screen name="banks" options={{ title: 'Banks', tabBarIcon: ({ focused }) => <TabIcon emoji="🏦" focused={focused} brandPrimary={colors.brandPrimary} /> }} />
      <Tabs.Screen
        name="mode"
        options={{
          title: modeTabTitle,
          href: showModeTab ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon emoji={modeTabEmoji} focused={focused} brandPrimary={colors.brandPrimary} />,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} brandPrimary={colors.brandPrimary} /> }} />
    </Tabs>
  );
}