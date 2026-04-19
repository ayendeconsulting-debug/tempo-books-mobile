import { useAuth } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList,
  RefreshControl, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';

const WEB_APP = 'https://gettempo.ca';

const STATUS_COLOR: Record<string, string> = {
  good: '#0F6E56',
  requires_action: '#DC2626',
  pending: '#D97706',
};

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#9CA3AF';
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

export default function BanksScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: items, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['plaid-items', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken();
      setAuthToken(token);
      const res = await apiClient.get('/plaid/items');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  // Fetch accounts for expanded item
  const { data: expandedAccounts } = useQuery({
    queryKey: ['plaid-accounts', expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      const token = await getToken();
      setAuthToken(token);
      const res = await apiClient.get(`/plaid/items/${expandedId}/accounts`);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  async function handleSync(itemId: string) {
    setSyncingId(itemId);
    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await apiClient.post(`/plaid/items/${itemId}/sync`);
      const { added, modified, removed } = res.data;
      Alert.alert('Sync Complete', `${added} added · ${modified} updated · ${removed} removed`);
      qc.invalidateQueries({ queryKey: ['plaid-items', activeBusiness?.id] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['sparkline'] });
    } catch (err: any) {
      Alert.alert('Sync Failed', err?.response?.data?.message ?? 'Could not sync. Please try again.');
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDisconnect(item: any) {
    Alert.alert(
      'Disconnect Bank',
      `Disconnect ${item.institution_name}? Your existing transactions will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect', style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              setAuthToken(token);
              await apiClient.delete(`/plaid/items/${item.id}`);
              qc.invalidateQueries({ queryKey: ['plaid-items', activeBusiness?.id] });
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message ?? 'Failed to disconnect.');
            }
          },
        },
      ]
    );
  }

  function renderItem({ item }: { item: any }) {
    const isExpanded = expandedId === item.id;
    const isSyncing = syncingId === item.id;
    const status = item.status ?? 'good';
    const lastSync = item.last_successful_update
      ? new Date(item.last_successful_update).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Never';

    return (
      <View style={{ backgroundColor: colors.card, marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden', elevation: 1 }}>
        {/* Bank header row */}
        <TouchableOpacity
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
          style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <StatusDot status={status} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.institution_name ?? 'Bank'}</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 3 }}>
              Last sync: {lastSync}
            </Text>
            {status === 'requires_action' && (
              <Text style={{ fontSize: 12, color: colors.danger, marginTop: 2, fontWeight: '600' }}>
                ⚠ Reconnection required
              </Text>
            )}
          </View>
          <Text style={{ fontSize: 20, color: colors.subtext }}>{isExpanded ? '∧' : '∨'}</Text>
        </TouchableOpacity>

        {/* Expanded accounts list */}
        {isExpanded && (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.divider }}>
            {!expandedAccounts ? (
              <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
            ) : expandedAccounts.length === 0 ? (
              <Text style={{ padding: 16, color: colors.subtext, fontSize: 13 }}>No accounts found</Text>
            ) : (
              expandedAccounts.map((acc: any) => {
                const balance = parseFloat(acc.current_balance ?? acc.balance ?? 0);
                return (
                  <View key={acc.id} style={{
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: colors.divider,
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
                        {acc.name ?? acc.account_name}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 1, textTransform: 'capitalize' }}>
                        {acc.type} {acc.subtype ? `· ${acc.subtype}` : ''}
                        {acc.mask ? ` ···${acc.mask}` : ''}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: balance < 0 ? colors.danger : colors.text }}>
                      {balance < 0 ? '-' : ''}${Math.abs(balance).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                );
              })
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10, padding: 14 }}>
              <TouchableOpacity
                onPress={() => handleSync(item.id)}
                disabled={isSyncing}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center' }}
              >
                {isSyncing
                  ? <ActivityIndicator color={colors.primary} size="small" />
                  : <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>↻ Sync Now</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDisconnect(item)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.dangerLight, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.danger }}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.divider,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Bank Accounts</Text>
        <TouchableOpacity
          onPress={() => Linking.openURL(`${WEB_APP}/banks`)}
          style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add Bank</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ padding: 48, alignItems: 'center' }}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>🏦</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 }}>No banks connected</Text>
              <Text style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', marginBottom: 24 }}>
                Connect your bank to automatically import transactions
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(`${WEB_APP}/banks`)}
                style={{ backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Connect a Bank</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}
