import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';
import { RADIUS } from '../../lib/tokens';
import Card from '../../components/ui/Card';
import KpiTile from '../../components/ui/KpiTile';
import HeroCard from '../../components/ui/HeroCard';

function sumValues(arr: any[]): number {
  if (!Array.isArray(arr)) return Number(arr) || 0;
  return arr.reduce((s, i) => s + (Number(i.value) || 0), 0);
}

function fmt(amount: number) {
  return '$' + Math.abs(amount).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function DashboardScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const mode = activeBusiness?.mode ?? 'business';

  const { data: sparkline, isLoading, refetch: refetchKPI } = useQuery({
    queryKey: ['sparkline', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/reports/sparkline');
      return res.data;
    },
  });

  const { data: pendingData, refetch: refetchPending } = useQuery({
    queryKey: ['pending-count', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/classification/raw?status=pending&limit=1&offset=0');
      return res.data;
    },
  });

  const { data: overdueCount, refetch: refetchInvoices } = useQuery({
    queryKey: ['overdue-invoices', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/invoices?status=overdue&limit=1');
      return res.data?.total ?? 0;
    },
  });

  const { data: mileageData, refetch: refetchMileage } = useQuery({
    queryKey: ['mileage-ytd', activeBusiness?.id],
    enabled: !!activeBusiness?.id && mode === 'freelancer',
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const year = new Date().getFullYear();
      const res = await apiClient.get(`/freelancer/mileage?year=${year}`);
      const logs = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      const totalKm = logs.reduce((s: number, l: any) => s + (parseFloat(l.distance_km) || 0), 0);
      return { totalKm, deduction: totalKm * 0.70 };
    },
  });

  const { data: taxEstimate, refetch: refetchTax } = useQuery({
    queryKey: ['tax-estimate', activeBusiness?.id],
    enabled: !!activeBusiness?.id && mode === 'freelancer',
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/freelancer/tax-estimate');
      return res.data;
    },
  });

  const { data: budgetCategories, refetch: refetchBudget } = useQuery({
    queryKey: ['budget-categories', activeBusiness?.id],
    enabled: !!activeBusiness?.id && mode === 'personal',
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/personal/budget-categories');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: netWorth, refetch: refetchNetWorth } = useQuery({
    queryKey: ['net-worth', activeBusiness?.id],
    enabled: !!activeBusiness?.id && mode === 'personal',
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/personal/net-worth');
      return res.data;
    },
  });

  function onRefresh() {
    refetchKPI(); refetchPending(); refetchInvoices();
    if (mode === 'freelancer') { refetchMileage(); refetchTax(); }
    if (mode === 'personal') { refetchBudget(); refetchNetWorth(); }
  }

  const revenue = sumValues(sparkline?.revenue);
  const expenses = Math.abs(sumValues(sparkline?.expenses));
  const netIncome = revenue - expenses;
  const pendingCount = pendingData?.total ?? 0;
  const topCategories = (budgetCategories ?? []).filter((c: any) => c.type !== 'income' && c.monthly_target > 0).slice(0, 3);
  const totalNetWorth = (netWorth?.total_assets ?? 0) - (netWorth?.total_liabilities ?? 0);

  const isNetPositive = netIncome >= 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceApp }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
    >
      <View style={{ padding: 16, gap: 12 }}>
        {/* Header */}
        <View style={{ marginBottom: 4 }}>
          <Text style={{
            fontSize: 22,
            lineHeight: 28,
            fontFamily: 'Manrope_700Bold',
            fontWeight: '700',
            color: colors.inkPrimary,
          }}>
            {activeBusiness?.name ?? 'Loading...'}
          </Text>
          <Text style={{
            fontSize: 12,
            fontFamily: 'Manrope_400Regular',
            color: colors.inkSecondary,
            marginTop: 2,
          }}>
            This month
          </Text>
        </View>

        {/* Net Income hero - HeroCard if positive, fallback Card if negative */}
        {isLoading ? (
          <Card padding="prominent">
            <ActivityIndicator color={colors.brandPrimary} />
          </Card>
        ) : isNetPositive ? (
          <HeroCard
            label="Net income this month"
            value={fmt(netIncome)}
          />
        ) : (
          <Card accent="negative" padding="prominent">
            <Text style={{
              fontSize: 11,
              fontFamily: 'Manrope_600SemiBold',
              fontWeight: '600',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: colors.accentNegative,
            }}>
              Net loss this month
            </Text>
            <Text style={{
              fontSize: 28,
              lineHeight: 34,
              fontFamily: 'Manrope_700Bold',
              fontWeight: '700',
              color: colors.accentNegative,
              marginTop: 6,
              fontVariant: ['tabular-nums'],
            }}>
              -{fmt(netIncome)}
            </Text>
          </Card>
        )}

        {/* Revenue / Expenses tiles */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <KpiTile
              label="Revenue"
              value={isLoading ? '...' : fmt(revenue)}
              accent="positive"
            />
          </View>
          <View style={{ flex: 1 }}>
            <KpiTile
              label="Expenses"
              value={isLoading ? '...' : fmt(expenses)}
              accent="negative"
            />
          </View>
        </View>

        {/* Pending Review */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/transactions')}
          activeOpacity={0.7}
        >
          <Card>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <View>
                <Text style={{
                  fontSize: 14,
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                  color: colors.inkPrimary,
                }}>
                  Pending Review
                </Text>
                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Manrope_400Regular',
                  color: colors.inkSecondary,
                  marginTop: 2,
                }}>
                  Tap to classify
                </Text>
              </View>
              <View style={{
                backgroundColor: pendingCount > 0 ? colors.primaryLight : colors.surfaceCardElevated,
                borderRadius: RADIUS.pill,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}>
                <Text style={{
                  color: pendingCount > 0 ? colors.brandPrimary : colors.inkSecondary,
                  fontFamily: 'Manrope_700Bold',
                  fontWeight: '700',
                  fontSize: 16,
                  fontVariant: ['tabular-nums'],
                }}>
                  {String(pendingCount)}
                </Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>

        {/* Overdue Invoices */}
        {(overdueCount ?? 0) > 0 && (
          <Card accent="negative">
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <View>
                <Text style={{
                  fontSize: 14,
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                  color: colors.accentNegative,
                }}>
                  Overdue Invoices
                </Text>
                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Manrope_400Regular',
                  color: colors.inkSecondary,
                  marginTop: 2,
                }}>
                  Require attention
                </Text>
              </View>
              <Text style={{
                color: colors.accentNegative,
                fontFamily: 'Manrope_700Bold',
                fontWeight: '700',
                fontSize: 18,
                fontVariant: ['tabular-nums'],
              }}>
                {String(overdueCount)}
              </Text>
            </View>
          </Card>
        )}

        {/* Freelancer: Mileage YTD */}
        {mode === 'freelancer' && mileageData && (
          <TouchableOpacity
            onPress={() => router.push('/freelancer/mileage')}
            activeOpacity={0.7}
          >
            <Card>
              <Text style={{
                fontSize: 12,
                fontFamily: 'Manrope_400Regular',
                color: colors.inkSecondary,
                marginBottom: 4,
              }}>
                Mileage YTD
              </Text>
              <Text style={{
                fontSize: 20,
                fontFamily: 'Manrope_700Bold',
                fontWeight: '700',
                color: colors.inkPrimary,
                fontVariant: ['tabular-nums'],
              }}>
                {mileageData.totalKm.toFixed(1)} km
              </Text>
              <Text style={{
                fontSize: 12,
                fontFamily: 'Manrope_400Regular',
                color: colors.brandPrimary,
                marginTop: 4,
                fontVariant: ['tabular-nums'],
              }}>
                Est. deduction: {fmt(mileageData.deduction)}
              </Text>
            </Card>
          </TouchableOpacity>
        )}

        {/* Freelancer: Tax Estimate */}
        {mode === 'freelancer' && taxEstimate && (
          <Card accent="warning">
            <Text style={{
              fontSize: 12,
              fontFamily: 'Manrope_600SemiBold',
              fontWeight: '600',
              color: colors.accentWarning,
              marginBottom: 4,
            }}>
              Tax Estimate {new Date().getFullYear()}
            </Text>
            <Text style={{
              fontSize: 20,
              fontFamily: 'Manrope_700Bold',
              fontWeight: '700',
              color: colors.accentWarning,
              fontVariant: ['tabular-nums'],
            }}>
              {fmt(taxEstimate.estimated_tax_owing ?? 0)}
            </Text>
            <Text style={{
              fontSize: 11,
              fontFamily: 'Manrope_400Regular',
              color: colors.inkSecondary,
              marginTop: 4,
            }}>
              Estimate only — consult a tax professional
            </Text>
          </Card>
        )}

        {/* Personal: Budget */}
        {mode === 'personal' && topCategories.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/personal/budget')}
            activeOpacity={0.7}
          >
            <Card>
              <Text style={{
                fontSize: 14,
                fontFamily: 'Manrope_700Bold',
                fontWeight: '700',
                color: colors.inkPrimary,
                marginBottom: 12,
              }}>
                Budget
              </Text>
              {topCategories.map((cat: any) => {
                const spent = parseFloat(cat.spent_this_month ?? 0);
                const target = parseFloat(cat.monthly_target ?? 0);
                const progress = target > 0 ? Math.min(spent / target, 1) : 0;
                const isOver = progress >= 1;
                return (
                  <View key={cat.id} style={{ marginBottom: 10 }}>
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: cat.color ?? colors.inkSecondary,
                        }} />
                        <Text style={{
                          fontSize: 13,
                          fontFamily: 'Manrope_400Regular',
                          color: colors.inkPrimary,
                        }}>
                          {cat.name}
                        </Text>
                      </View>
                      <Text style={{
                        fontSize: 12,
                        fontFamily: 'Manrope_400Regular',
                        color: isOver ? colors.accentNegative : colors.inkSecondary,
                        fontVariant: ['tabular-nums'],
                      }}>
                        {fmt(spent)} / {fmt(target)}
                      </Text>
                    </View>
                    <View style={{
                      height: 6,
                      backgroundColor: colors.borderSubtle,
                      borderRadius: 3,
                    }}>
                      <View style={{
                        height: 6,
                        width: `${progress * 100}%`,
                        backgroundColor: isOver ? colors.accentNegative : (cat.color ?? colors.brandPrimary),
                        borderRadius: 3,
                      }} />
                    </View>
                  </View>
                );
              })}
            </Card>
          </TouchableOpacity>
        )}

        {/* Personal: Net Worth */}
        {mode === 'personal' && netWorth != null && (
          <TouchableOpacity
            onPress={() => router.push('/personal/net-worth')}
            activeOpacity={0.7}
          >
            <Card>
              <Text style={{
                fontSize: 12,
                fontFamily: 'Manrope_400Regular',
                color: colors.inkSecondary,
                marginBottom: 4,
              }}>
                Net Worth
              </Text>
              <Text style={{
                fontSize: 22,
                lineHeight: 28,
                fontFamily: 'Manrope_700Bold',
                fontWeight: '700',
                color: totalNetWorth >= 0 ? colors.accentPositive : colors.accentNegative,
                fontVariant: ['tabular-nums'],
              }}>
                {fmt(totalNetWorth)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Manrope_400Regular',
                  color: colors.accentPositive,
                  fontVariant: ['tabular-nums'],
                }}>
                  Assets {fmt(netWorth.total_assets ?? 0)}
                </Text>
                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Manrope_400Regular',
                  color: colors.accentNegative,
                  fontVariant: ['tabular-nums'],
                }}>
                  Liabilities {fmt(netWorth.total_liabilities ?? 0)}
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}