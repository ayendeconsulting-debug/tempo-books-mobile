import { useAuth } from '@clerk/clerk-expo';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, FlatList, Text, TextInput,
  TouchableOpacity, View, RefreshControl,
} from 'react-native';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';

type BusinessTab = 'all' | 'pending' | 'classified' | 'posted';
type PersonalTab = 'all' | 'pending' | 'categorized';
type FreelancerTab = 'all' | 'pending' | 'classified' | 'posted';

const BUSINESS_TABS: BusinessTab[] = ['all', 'pending', 'classified', 'posted'];
const PERSONAL_TABS: PersonalTab[] = ['all', 'pending', 'categorized'];
const FREELANCER_TABS: FreelancerTab[] = ['all', 'pending', 'classified', 'posted'];

const TAB_LABEL: Record<string, string> = {
  all: 'All', pending: 'Pending', classified: 'Classified', posted: 'Posted', categorized: 'Categorized',
};

const STATUS_COLOR: Record<string, string> = {
  pending: '#D97706', classified: '#2563EB', posted: '#0F6E56', categorized: '#7C3AED', ignored: '#9CA3AF',
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

function BizPersonalBadge({ isPersonal }: { isPersonal: boolean }) {
  return (
    <View style={{ backgroundColor: isPersonal ? '#F3F4F6' : '#EDF7F2', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: isPersonal ? '#9CA3AF' : '#0F6E56' }}>
        {isPersonal ? 'P' : 'B'}
      </Text>
    </View>
  );
}

export default function TransactionsScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const mode = activeBusiness?.mode ?? 'business';

  const tabs = mode === 'personal' ? PERSONAL_TABS : mode === 'freelancer' ? FREELANCER_TABS : BUSINESS_TABS;
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } = useInfiniteQuery({
    queryKey: ['transactions', activeBusiness?.id, activeTab, search],
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
      if (search.trim()) params.set('search', search.trim());
      const res = await apiClient.get(`/classification/raw?${params}`);
      return res.data;
    },
  });

  const transactions = data?.pages.flatMap((p: any) => p.data ?? []) ?? [];

  function getDisplayStatus(item: any): string {
    if (mode === 'personal' && item.personal_category_id) return 'categorized';
    return item.status ?? 'pending';
  }

  function renderItem({ item }: { item: any }) {
    const amount = parseFloat(item.amount ?? 0);
    const isCredit = amount < 0;
    const displayDate = item.date ? new Date(item.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '';
    const displayStatus = getDisplayStatus(item);
    return (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id, data: JSON.stringify(item) } })}
        style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>
            {item.description ?? item.raw_description ?? ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 12, color: colors.subtext }}>{displayDate}</Text>
            <StatusBadge status={displayStatus} />
            {mode === 'freelancer' && <BizPersonalBadge isPersonal={item.is_personal ?? false} />}
            {mode === 'personal' && item.personal_category?.name && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {item.personal_category?.color && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.personal_category.color }} />
                )}
                <Text style={{ fontSize: 11, color: colors.subtext }} numberOfLines={1}>{item.personal_category.name}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: isCredit ? colors.primary : colors.text }}>
          {isCredit ? '+' : ''}{Math.abs(amount).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Search */}
      <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="Search transactions..."
          placeholderTextColor={colors.placeholder}
          style={{ backgroundColor: colors.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.inputBorder }}
        />
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)}
            style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === tab ? colors.primary : 'transparent' }}>
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
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ color: colors.subtext, fontSize: 14 }}>No transactions found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
