import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';

const FREQ_COLOR: Record<string, string> = { weekly: '#2563EB', monthly: '#0F6E56', quarterly: '#D97706', annually: '#7C3AED' };

export default function PersonalRecurringScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const { colors } = useTheme();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['personal-recurring', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/personal/recurring-confirmed');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Recurring Payments</Text>
      </View>
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item, idx) => item.id ?? String(idx)}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const amount = parseFloat(item.amount ?? 0);
            const freq = item.frequency ?? 'monthly';
            return (
              <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{item.merchant ?? item.description}</Text>
                  <View style={{ marginTop: 4 }}>
                    <View style={{ backgroundColor: (FREQ_COLOR[freq] ?? '#9CA3AF') + '18', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
                      <Text style={{ fontSize: 11, color: FREQ_COLOR[freq] ?? colors.subtext, fontWeight: '600', textTransform: 'capitalize' }}>{freq}</Text>
                    </View>
                  </View>
                  {item.next_date && <Text style={{ fontSize: 11, color: colors.placeholder, marginTop: 4 }}>Next: {new Date(item.next_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</Text>}
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>${Math.abs(amount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</Text>
              </View>
            );
          }}
          ListEmptyComponent={<View style={{ padding: 48, alignItems: 'center' }}><Text style={{ fontSize: 32, marginBottom: 8 }}>🔁</Text><Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>No recurring payments confirmed</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}
