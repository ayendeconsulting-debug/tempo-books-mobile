import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';

export default function UpcomingPaymentsScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const { colors } = useTheme();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['upcoming-reminders', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/personal/upcoming-reminders');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Upcoming Payments</Text>
      </View>
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item, idx) => item.key ?? String(idx)}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const amount = parseFloat(item.amount ?? 0);
            const dueDate = item.due_date ? new Date(item.due_date) : null;
            const daysUntil = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null;
            const isUrgent = daysUntil != null && daysUntil <= 3;
            return (
              <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, borderLeftWidth: isUrgent ? 3 : 0, borderLeftColor: colors.danger, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{item.merchant ?? item.description}</Text>
                  {dueDate && (
                    <Text style={{ fontSize: 12, color: isUrgent ? colors.danger : colors.placeholder, marginTop: 2, fontWeight: isUrgent ? '600' : '400' }}>
                      Due {dueDate.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                      {daysUntil != null && daysUntil >= 0 && ` · in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`}
                      {daysUntil != null && daysUntil < 0 && ' · overdue'}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>${Math.abs(amount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</Text>
              </View>
            );
          }}
          ListEmptyComponent={<View style={{ padding: 48, alignItems: 'center' }}><Text style={{ fontSize: 32, marginBottom: 8 }}>🔔</Text><Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>No upcoming payments</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}
