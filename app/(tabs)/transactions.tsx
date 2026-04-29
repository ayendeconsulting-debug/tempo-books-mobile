import { useAuth } from '@clerk/clerk-expo';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';
import { RADIUS } from '../../lib/tokens';
import Pill from '../../components/ui/Pill';

type Bucket =
  | 'all'
  | 'needs_review'
  | 'business'
  | 'personal'
  | 'classified'
  | 'categorized'
  | 'posted';

type Mode = 'business' | 'freelancer' | 'personal';

const BUCKETS_BY_MODE: Record<Mode, Bucket[]> = {
  business:   ['all', 'needs_review', 'classified', 'posted'],
  personal:   ['all', 'needs_review', 'categorized'],
  freelancer: ['all', 'needs_review', 'business', 'personal', 'posted'],
};

const TAB_LABEL: Record<Bucket, string> = {
  all: 'All',
  needs_review: 'Needs Review',
  business: 'Business',
  personal: 'Personal',
  classified: 'Classified',
  categorized: 'Categorized',
  posted: 'Posted',
};

const EMPTY_BY_BUCKET: Record<Bucket, string> = {
  all: 'Connect a bank account to start importing transactions.',
  needs_review: 'Inbox zero. Nothing waiting for a decision right now.',
  business: 'No business transactions waiting to be posted. Classify a row from Needs Review to land it here.',
  personal: 'No personal transactions categorized yet. Tag a row Personal from Needs Review and pick a budget category.',
  classified: 'No transactions waiting to be posted. Classify a row from Needs Review to land it here.',
  categorized: 'No transactions categorized yet. Pick a budget category from Needs Review.',
  posted: 'No posted transactions yet. Post a classified row to land it here.',
};

type PillVariant = 'positive' | 'negative' | 'warning' | 'info' | 'neutral' | 'brand';

// categorized maps to info (Path B) - no purple token in Direction B
const STATUS_VARIANT: Record<string, PillVariant> = {
  pending: 'warning',
  classified: 'info',
  posted: 'positive',
  categorized: 'info',
  ignored: 'neutral',
};

const LIMIT = 20;

type BucketCounts = Partial<Record<Bucket, number>>;

function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] ?? 'neutral';
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Pill variant={variant} size="sm">{label}</Pill>;
}

function BizPersonalBadge({ isPersonal }: { isPersonal: boolean }) {
  return (
    <Pill variant={isPersonal ? 'neutral' : 'brand'} size="sm">
      {isPersonal ? 'P' : 'B'}
    </Pill>
  );
}

export default function TransactionsScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const mode = (activeBusiness?.mode ?? 'business') as Mode;

  const tabs = BUCKETS_BY_MODE[mode] ?? BUCKETS_BY_MODE.business;
  const [activeTab, setActiveTab] = useState<Bucket>('needs_review');
  const [search, setSearch] = useState('');

  const { data: bucketCounts, refetch: refetchCounts } = useQuery<BucketCounts>({
    queryKey: ['classification-counts', activeBusiness?.id, search],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      const qs = params.toString();
      const res = await apiClient.get(`/classification/raw/counts${qs ? `?${qs}` : ''}`);
      return res.data as BucketCounts;
    },
  });

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
  const needsReviewCount = bucketCounts?.needs_review ?? 0;

  function getDisplayStatus(item: any): string {
    if (mode === 'personal' && item.personal_category_id) return 'categorized';
    return item.status ?? 'pending';
  }

  function onRefreshAll() {
    refetch();
    refetchCounts();
  }

  function renderItem({ item }: { item: any }) {
    const amount = parseFloat(item.amount ?? 0);
    const isCredit = amount < 0;
    const displayDate = item.date ? new Date(item.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '';
    const displayStatus = getDisplayStatus(item);
    return (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id, data: JSON.stringify(item) } })}
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
            {item.description ?? item.raw_description ?? ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <Text style={{
              fontSize: 12,
              fontFamily: 'Manrope_400Regular',
              color: colors.inkSecondary,
              fontVariant: ['tabular-nums'],
            }}>
              {displayDate}
            </Text>
            <StatusBadge status={displayStatus} />
            {mode === 'freelancer' && <BizPersonalBadge isPersonal={item.is_personal ?? false} />}
            {mode === 'personal' && item.personal_category?.name && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {item.personal_category?.color && (
                  <View style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: item.personal_category.color,
                  }} />
                )}
                <Text style={{
                  fontSize: 11,
                  fontFamily: 'Manrope_400Regular',
                  color: colors.inkSecondary,
                }} numberOfLines={1}>
                  {item.personal_category.name}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Text style={{
          fontSize: 15,
          fontFamily: 'Manrope_700Bold',
          fontWeight: '700',
          color: isCredit ? colors.accentPositive : colors.inkPrimary,
          fontVariant: ['tabular-nums'],
        }}>
          {isCredit ? '+' : ''}{Math.abs(amount).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceApp }}>
      {/* Search */}
      <View style={{
        backgroundColor: colors.surfaceCard,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
      }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search transactions..."
          placeholderTextColor={colors.inkTertiary}
          style={{
            backgroundColor: colors.inputBg,
            borderRadius: RADIUS.md,
            paddingHorizontal: 14,
            paddingVertical: 9,
            fontSize: 14,
            fontFamily: 'Manrope_400Regular',
            color: colors.inkPrimary,
            borderWidth: 0.5,
            borderColor: colors.borderDefault,
          }}
        />
      </View>

      {/* Header - Needs Review count */}
      <View style={{
        backgroundColor: colors.surfaceCard,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
      }}>
        <Text style={{
          fontSize: 12,
          fontFamily: 'Manrope_600SemiBold',
          fontWeight: '600',
          color: colors.inkSecondary,
          fontVariant: ['tabular-nums'],
        }}>
          {needsReviewCount} needs review
        </Text>
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceCard,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
      }}>
        {tabs.map((tab) => {
          const count = bucketCounts?.[tab] ?? 0;
          const isActive = activeTab === tab;
          const showBadge = tab !== 'all' && count > 0;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor: isActive ? colors.brandPrimary : 'transparent',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{
                  fontSize: 12,
                  fontFamily: isActive ? 'Manrope_700Bold' : 'Manrope_400Regular',
                  fontWeight: isActive ? '700' : '400',
                  color: isActive ? colors.brandPrimary : colors.inkSecondary,
                }}>
                  {TAB_LABEL[tab]}
                </Text>
                {showBadge && (
                  <View style={{
                    backgroundColor: isActive ? colors.primaryLight : colors.surfaceCardElevated,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: RADIUS.sm,
                    minWidth: 20,
                    alignItems: 'center',
                  }}>
                    <Text style={{
                      fontSize: 10,
                      fontFamily: 'Manrope_700Bold',
                      fontWeight: '700',
                      color: isActive ? colors.brandPrimary : colors.inkSecondary,
                      fontVariant: ['tabular-nums'],
                    }}>
                      {count}
                    </Text>
                  </View>
                )}
              </View>
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
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefreshAll} tintColor={colors.brandPrimary} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.brandPrimary} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{
                color: colors.inkSecondary,
                fontSize: 14,
                fontFamily: 'Manrope_400Regular',
                textAlign: 'center',
                lineHeight: 20,
              }}>
                {EMPTY_BY_BUCKET[activeTab]}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}