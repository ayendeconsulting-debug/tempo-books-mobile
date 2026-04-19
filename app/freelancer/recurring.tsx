import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';

const FREQ_COLOR: Record<string, string> = { weekly: '#2563EB', monthly: '#0F6E56', quarterly: '#D97706', annually: '#7C3AED' };
const STATUS_COLOR: Record<string, string> = { active: '#0F6E56', paused: '#D97706', cancelled: '#9CA3AF' };

export default function FreelancerRecurringScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { colors } = useTheme();

  const { data: items, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['recurring', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/recurring');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  async function handleAction(item: any, action: 'pause' | 'resume' | 'cancel') {
    const labels = { pause: 'Pause', resume: 'Resume', cancel: 'Cancel' };
    Alert.alert(labels[action], `${labels[action]} this recurring transaction?`, [
      { text: 'Back', style: 'cancel' },
      { text: labels[action], style: action === 'cancel' ? 'destructive' : 'default', onPress: async () => {
        try {
          const token = await getToken(); setAuthToken(token);
          if (action === 'cancel') { await apiClient.delete(`/recurring/${item.id}`); }
          else { await apiClient.post(`/recurring/${item.id}/${action}`); }
          qc.invalidateQueries({ queryKey: ['recurring', activeBusiness?.id] });
        } catch (err: any) { Alert.alert('Error', err?.response?.data?.message ?? `Failed to ${action}.`); }
      }},
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Recurring Transactions</Text>
      </View>
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const amount = parseFloat(item.amount ?? 0);
            const status = item.status ?? 'active';
            const freq = item.frequency ?? 'monthly';
            return (
              <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{item.description}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <View style={{ backgroundColor: (FREQ_COLOR[freq] ?? '#9CA3AF') + '18', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, color: FREQ_COLOR[freq] ?? colors.subtext, fontWeight: '600', textTransform: 'capitalize' }}>{freq}</Text>
                      </View>
                      <View style={{ backgroundColor: (STATUS_COLOR[status] ?? '#9CA3AF') + '18', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, color: STATUS_COLOR[status] ?? colors.subtext, fontWeight: '600', textTransform: 'capitalize' }}>{status}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                    ${Math.abs(amount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                {status !== 'cancelled' && (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                    {status === 'active' && (
                      <TouchableOpacity onPress={() => handleAction(item, 'pause')}
                        style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.warningLight }}>
                        <Text style={{ fontSize: 12, color: colors.warning, fontWeight: '600' }}>Pause</Text>
                      </TouchableOpacity>
                    )}
                    {status === 'paused' && (
                      <TouchableOpacity onPress={() => handleAction(item, 'resume')}
                        style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.primaryLight }}>
                        <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Resume</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleAction(item, 'cancel')}
                      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.dangerLight }}>
                      <Text style={{ fontSize: 12, color: colors.danger, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: 48, alignItems: 'center' }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🔁</Text>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>No recurring transactions</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
