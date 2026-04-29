import { useAuth } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';
import { RADIUS } from '../../lib/tokens';
import Button from '../../components/ui/Button';

const WEB_APP = 'https://gettempo.ca';

function StatusDot({ status }: { status: string }) {
  const { colors } = useTheme();
  const STATUS_COLOR_MAP: Record<string, string> = {
    good: colors.accentPositive,
    requires_action: colors.accentNegative,
    pending: colors.accentWarning,
  };
  const color = STATUS_COLOR_MAP[status] ?? colors.inkTertiary;
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
      <View style={{
        backgroundColor: colors.surfaceCard,
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: RADIUS.lg,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        overflow: 'hidden',
      }}>
        {/* Bank header row */}
        <TouchableOpacity
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
          activeOpacity={0.7}
          style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <StatusDot status={status} />
              <Text style={{
                fontSize: 16,
                fontFamily: 'Manrope_700Bold',
                fontWeight: '700',
                color: colors.inkPrimary,
              }}>
                {item.institution_name ?? 'Bank'}
              </Text>
            </View>
            <Text style={{
              fontSize: 12,
              fontFamily: 'Manrope_400Regular',
              color: colors.inkSecondary,
              marginTop: 3,
            }}>
              Last sync: {lastSync}
            </Text>
            {status === 'requires_action' && (
              <Text style={{
                fontSize: 12,
                fontFamily: 'Manrope_600SemiBold',
                fontWeight: '600',
                color: colors.accentNegative,
                marginTop: 2,
              }}>
                ⚠ Reconnection required
              </Text>
            )}
          </View>
          <Text style={{
            fontSize: 20,
            color: colors.inkSecondary,
          }}>
            {isExpanded ? '∧' : '∨'}
          </Text>
        </TouchableOpacity>

        {/* Expanded accounts list */}
        {isExpanded && (
          <View style={{ borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }}>
            {!expandedAccounts ? (
              <ActivityIndicator color={colors.brandPrimary} style={{ padding: 16 }} />
            ) : expandedAccounts.length === 0 ? (
              <Text style={{
                padding: 16,
                color: colors.inkSecondary,
                fontFamily: 'Manrope_400Regular',
                fontSize: 13,
              }}>
                No accounts found
              </Text>
            ) : (
              expandedAccounts.map((acc: any) => {
                const balance = parseFloat(acc.current_balance ?? acc.balance ?? 0);
                return (
                  <View key={acc.id} style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.borderSubtle,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <View>
                      <Text style={{
                        fontSize: 14,
                        fontFamily: 'Manrope_600SemiBold',
                        fontWeight: '600',
                        color: colors.inkPrimary,
                      }}>
                        {acc.name ?? acc.account_name}
                      </Text>
                      <Text style={{
                        fontSize: 12,
                        fontFamily: 'Manrope_400Regular',
                        color: colors.inkSecondary,
                        marginTop: 1,
                        textTransform: 'capitalize',
                      }}>
                        {acc.type} {acc.subtype ? `· ${acc.subtype}` : ''}
                        {acc.mask ? ` ···${acc.mask}` : ''}
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: 15,
                      fontFamily: 'Manrope_700Bold',
                      fontWeight: '700',
                      color: balance < 0 ? colors.accentNegative : colors.inkPrimary,
                      fontVariant: ['tabular-nums'],
                    }}>
                      {balance < 0 ? '-' : ''}${Math.abs(balance).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                );
              })
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10, padding: 14 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="↻ Sync Now"
                  onPress={() => handleSync(item.id)}
                  variant="tertiary"
                  size="sm"
                  fullWidth
                  loading={isSyncing}
                />
              </View>
              <TouchableOpacity
                onPress={() => handleDisconnect(item)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: RADIUS.md,
                  borderWidth: 0.5,
                  borderColor: colors.accentNegative,
                  backgroundColor: 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                  color: colors.accentNegative,
                }}>
                  Disconnect
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceApp }}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.surfaceCard,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: 16,
          fontFamily: 'Manrope_700Bold',
          fontWeight: '700',
          color: colors.inkPrimary,
        }}>
          Bank Accounts
        </Text>
        <Button
          label="+ Add Bank"
          onPress={() => Linking.openURL(`${WEB_APP}/banks`)}
          variant="primary"
          size="sm"
        />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <View style={{ padding: 48, alignItems: 'center' }}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>🏦</Text>
              <Text style={{
                fontSize: 16,
                fontFamily: 'Manrope_700Bold',
                fontWeight: '700',
                color: colors.inkPrimary,
                marginBottom: 6,
              }}>
                No banks connected
              </Text>
              <Text style={{
                fontSize: 14,
                fontFamily: 'Manrope_400Regular',
                color: colors.inkSecondary,
                textAlign: 'center',
                marginBottom: 24,
              }}>
                Connect your bank to automatically import transactions
              </Text>
              <Button
                label="Connect a Bank"
                onPress={() => Linking.openURL(`${WEB_APP}/banks`)}
                variant="primary"
                size="lg"
              />
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}