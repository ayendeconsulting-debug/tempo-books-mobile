import { useAuth } from '@clerk/clerk-expo';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';
import Pill from '../../components/ui/Pill';
import Button from '../../components/ui/Button';

const TABS = ['all', 'draft', 'sent', 'overdue', 'paid'] as const;
type Tab = typeof TABS[number];

const TAB_LABEL: Record<Tab, string> = {
  all: 'All', draft: 'Draft', sent: 'Sent', overdue: 'Overdue', paid: 'Paid',
};

type PillVariant = 'positive' | 'negative' | 'warning' | 'info' | 'neutral' | 'brand';

const STATUS_VARIANT: Record<string, PillVariant> = {
  draft: 'neutral',
  sent: 'info',
  overdue: 'negative',
  paid: 'positive',
  partial: 'warning',
  void: 'neutral',
};

const LIMIT = 20;

function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] ?? 'neutral';
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Pill variant={variant} size="sm">{label}</Pill>;
}

export default function InvoicesScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('all');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } = useInfiniteQuery({
    queryKey: ['invoices', activeBusiness?.id, activeTab],
    enabled: !!activeBusiness?.id,
    initialPageParam: 0,
    getNextPageParam: (lastPage: any, pages) => {
      const total = lastPage?.total ?? 0;
      const loaded = pages.length * LIMIT;
      return loaded < total ? loaded : undefined;
    },
    queryFn: async ({ pageParam = 0 }) => {
      const token = await getToken(); setAuthToken(token);
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(pageParam) });
      if (activeTab !== 'all') params.set('status', activeTab);
      const res = await apiClient.get(`/invoices?${params}`);
      return res.data;
    },
  });

  const invoices = data?.pages.flatMap((p: any) => p.data ?? []) ?? [];

  function renderItem({ item }: { item: any }) {
    const total = parseFloat(item.total ?? item.subtotal ?? 0);
    const dueDate = item.due_date
      ? new Date(item.due_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    const isPaid = item.status === 'paid';
    const isOverdue = item.status === 'overdue';
    return (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: item.id, data: JSON.stringify(item) } })}
        activeOpacity={0.7}
        style={{
          backgroundColor: colors.surfaceCard,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.borderSubtle,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{
            fontSize: 14,
            fontFamily: 'Manrope_600SemiBold',
            fontWeight: '600',
            color: colors.inkPrimary,
          }} numberOfLines={1}>
            {item.client_name ?? ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Text style={{
              fontSize: 12,
              fontFamily: 'Manrope_400Regular',
              color: colors.inkSecondary,
            }}>
              {item.invoice_number ?? ''}
            </Text>
            <StatusBadge status={item.status ?? 'draft'} />
          </View>
          {dueDate ? (
            <Text style={{
              fontSize: 11,
              fontFamily: 'Manrope_400Regular',
              color: isOverdue ? colors.accentNegative : colors.inkSecondary,
              marginTop: 2,
            }}>
              Due {dueDate}
            </Text>
          ) : null}
        </View>
        <Text style={{
          fontSize: 15,
          fontFamily: 'Manrope_700Bold',
          fontWeight: '700',
          color: isPaid ? colors.accentPositive : colors.inkPrimary,
          fontVariant: ['tabular-nums'],
        }}>
          {total.toLocaleString('en-CA', { style: 'currency', currency: activeBusiness?.currency_code ?? 'CAD' })}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceApp }}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.surfaceCard,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Text style={{
          fontSize: 16,
          fontFamily: 'Manrope_700Bold',
          fontWeight: '700',
          color: colors.inkPrimary,
        }}>
          Invoices
        </Text>
        <Button
          label="+ New"
          onPress={() => router.push('/invoice/create')}
          variant="primary"
          size="sm"
        />
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceCard,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                paddingVertical: 11,
                alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor: isActive ? colors.brandPrimary : 'transparent',
              }}
            >
              <Text style={{
                fontSize: 12,
                fontFamily: isActive ? 'Manrope_700Bold' : 'Manrope_400Regular',
                fontWeight: isActive ? '700' : '400',
                color: isActive ? colors.brandPrimary : colors.inkSecondary,
              }}>
                {TAB_LABEL[tab]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.brandPrimary} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={
            <View style={{ padding: 48, alignItems: 'center' }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🧾</Text>
              <Text style={{
                color: colors.inkPrimary,
                fontSize: 15,
                fontFamily: 'Manrope_600SemiBold',
                fontWeight: '600',
              }}>
                No invoices yet
              </Text>
              <Text style={{
                color: colors.inkSecondary,
                fontSize: 13,
                fontFamily: 'Manrope_400Regular',
                marginTop: 4,
              }}>
                Tap + New to create your first invoice
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}