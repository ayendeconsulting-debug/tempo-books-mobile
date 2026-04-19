import { useAuth } from '@clerk/clerk-expo';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, FlatList, Text,
  TouchableOpacity, View, RefreshControl,
} from 'react-native';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';

const TABS = ['all', 'draft', 'sent', 'overdue', 'paid'] as const;
type Tab = typeof TABS[number];

const TAB_LABEL: Record<Tab, string> = {
  all: 'All', draft: 'Draft', sent: 'Sent', overdue: 'Overdue', paid: 'Paid',
};

const STATUS_COLOR: Record<string, string> = {
  draft: '#9CA3AF', sent: '#2563EB', overdue: '#DC2626', paid: '#0F6E56', partial: '#D97706', void: '#6B7280',
};

const LIMIT = 20;

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#9CA3AF';
  return (
    <View style={{ backgroundColor: color + '18', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ fontSize: 11, color, fontWeight: '600', textTransform: 'capitalize' }}>{status}</Text>
    </View>
  );
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
    return (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: item.id, data: JSON.stringify(item) } })}
        style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>
            {item.client_name ?? ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: colors.subtext }}>{item.invoice_number ?? ''}</Text>
            <StatusBadge status={item.status ?? 'draft'} />
          </View>
          {dueDate ? (
            <Text style={{ fontSize: 11, color: item.status === 'overdue' ? colors.danger : colors.subtext, marginTop: 2 }}>
              Due {dueDate}
            </Text>
          ) : null}
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: item.status === 'paid' ? colors.primary : colors.text }}>
          {total.toLocaleString('en-CA', { style: 'currency', currency: activeBusiness?.currency_code ?? 'CAD' })}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Invoices</Text>
        <TouchableOpacity
          onPress={() => router.push('/invoice/create')}
          style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)}
            style={{ flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === tab ? colors.primary : 'transparent' }}>
            <Text style={{ fontSize: 12, fontWeight: activeTab === tab ? '700' : '400', color: activeTab === tab ? colors.primary : colors.subtext }}>
              {TAB_LABEL[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={
            <View style={{ padding: 48, alignItems: 'center' }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🧾</Text>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>No invoices yet</Text>
              <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 4 }}>Tap + New to create your first invoice</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
