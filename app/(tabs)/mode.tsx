import { useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';

function MenuItem({ emoji, title, description, onPress }: {
  emoji: string; title: string; description: string; onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: colors.cardBorder, elevation: 1 }}
    >
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{title}</Text>
        <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{description}</Text>
      </View>
      <Text style={{ fontSize: 20, color: colors.subtext }}>›</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.subtext, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 4 }}>
      {title}
    </Text>
  );
}

function FreelancerHub() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 16, gap: 10 }}>
        <SectionHeader title="Tracking" />
        <MenuItem emoji="🚗" title="Mileage Tracker" description="Log business trips and track deductions" onPress={() => router.push('/freelancer/mileage')} />
        <MenuItem emoji="🔁" title="Recurring" description="View and manage recurring transactions" onPress={() => router.push('/freelancer/recurring')} />
        <SectionHeader title="Organization" />
        <MenuItem emoji="🏷️" title="Categories" description="Manage your expense and income categories" onPress={() => router.push('/freelancer/categories')} />
        <MenuItem emoji="⚡" title="Classification Rules" description="Auto-classify transactions by keyword or vendor" onPress={() => router.push('/freelancer/classification-rules')} />
        <MenuItem emoji="📋" title="Personal Rules" description="Auto-categorize personal transactions" onPress={() => router.push('/freelancer/personal-rules')} />
      </View>
    </ScrollView>
  );
}

function PersonalHub() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 16, gap: 10 }}>
        <SectionHeader title="Finance" />
        <MenuItem emoji="💰" title="Budget" description="Track spending against monthly targets" onPress={() => router.push('/personal/budget')} />
        <MenuItem emoji="🎯" title="Savings Goals" description="Track progress toward your financial goals" onPress={() => router.push('/personal/savings-goals')} />
        <MenuItem emoji="📈" title="Net Worth" description="Assets minus liabilities at a glance" onPress={() => router.push('/personal/net-worth')} />
        <SectionHeader title="Payments" />
        <MenuItem emoji="🔁" title="Recurring Payments" description="Confirmed subscriptions and bills" onPress={() => router.push('/personal/recurring')} />
        <MenuItem emoji="🔔" title="Upcoming Payments" description="Bills due soon" onPress={() => router.push('/personal/upcoming')} />
        <SectionHeader title="Automation" />
        <MenuItem emoji="📋" title="Personal Rules" description="Auto-categorize transactions by keyword" onPress={() => router.push('/personal/personal-rules')} />
      </View>
    </ScrollView>
  );
}

export default function ModeHubScreen() {
  const { activeBusiness } = useBusiness();
  const mode = activeBusiness?.mode;
  if (mode === 'freelancer') return <FreelancerHub />;
  if (mode === 'personal') return <PersonalHub />;
  return null;
}
