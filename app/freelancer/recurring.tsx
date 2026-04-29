import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';
import Pill from '../../components/ui/Pill';
import Button from '../../components/ui/Button';

type PillVariant = 'positive' | 'negative' | 'warning' | 'info' | 'neutral' | 'brand';

const FREQ_VARIANT: Record<string, PillVariant> = {
  weekly: 'info',
  monthly: 'positive',
  quarterly: 'warning',
  annually: 'brand',
};

const STATUS_VARIANT: Record<string, PillVariant> = {
  active: 'positive',
  paused: 'warning',
  cancelled: 'neutral',
};

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceApp }}>
      <View style={{
        backgroundColor: colors.surfaceCard,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
      }}>
        <Text style={{
          fontSize: 16,
          fontFamily: 'Manrope_700Bold',
          fontWeight: '700',
          color: colors.inkPrimary,
        }}>
          Recurring Transactions
        </Text>
      </View>
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => {
            const amount = parseFloat(item.amount ?? 0);
            const status = item.status ?? 'active';
            const freq = item.frequency ?? 'monthly';
            return (
              <View style={{
                backgroundColor: colors.surfaceCard,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.borderSubtle,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Manrope_600SemiBold',
                      fontWeight: '600',
                      color: colors.inkPrimary,
                    }}>
                      {item.description}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <Pill variant={FREQ_VARIANT[freq] ?? 'neutral'} size="sm">
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Pill>
                      <Pill variant={STATUS_VARIANT[status] ?? 'neutral'} size="sm">
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Pill>
                    </View>
                  </View>
                  <Text style={{
                    fontSize: 15,
                    fontFamily: 'Manrope_700Bold',
                    fontWeight: '700',
                    color: colors.inkPrimary,
                    fontVariant: ['tabular-nums'],
                  }}>
                    ${Math.abs(amount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                {status !== 'cancelled' && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    {status === 'active' && (
                      <Button
                        label="Pause"
                        onPress={() => handleAction(item, 'pause')}
                        variant="warning"
                        size="sm"
                      />
                    )}
                    {status === 'paused' && (
                      <Button
                        label="Resume"
                        onPress={() => handleAction(item, 'resume')}
                        variant="tertiary"
                        size="sm"
                      />
                    )}
                    <Button
                      label="Cancel"
                      onPress={() => handleAction(item, 'cancel')}
                      variant="destructive"
                      size="sm"
                    />
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: 48, alignItems: 'center' }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🔁</Text>
              <Text style={{
                color: colors.inkPrimary,
                fontSize: 15,
                fontFamily: 'Manrope_600SemiBold',
                fontWeight: '600',
              }}>
                No recurring transactions
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}