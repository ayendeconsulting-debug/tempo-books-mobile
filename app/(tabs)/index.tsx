import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View, RefreshControl, ActivityIndicator } from 'react-native';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';

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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{activeBusiness?.name ?? 'Loading...'}</Text>
          <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>This month</Text>
        </View>

        {/* Revenue / Expenses */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[
            { label: 'Revenue', value: fmt(revenue), color: colors.primary },
            { label: 'Expenses', value: fmt(expenses), color: colors.danger },
          ].map(({ label, value, color }) => (
            <View key={label} style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, elevation: 1 }}>
              <Text style={{ fontSize: 12, color: colors.subtext, marginBottom: 4 }}>{label}</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color }}>{isLoading ? '...' : value}</Text>
              <Text style={{ fontSize: 11, color: colors.subtext, marginTop: 2 }}>This month</Text>
            </View>
          ))}
        </View>

        {/* Net Income */}
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, borderTopWidth: 3, borderTopColor: netIncome >= 0 ? colors.primary : colors.danger, elevation: 1 }}>
          <Text style={{ fontSize: 12, color: colors.subtext, marginBottom: 4 }}>Net Income</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: netIncome >= 0 ? colors.primary : colors.danger }}>
            {isLoading ? '...' : fmt(netIncome)}
          </Text>
          <Text style={{ fontSize: 11, color: colors.subtext, marginTop: 2 }}>This month</Text>
        </View>

        {/* Pending Review */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/transactions')}
          style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 1 }}
        >
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Pending Review</Text>
            <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>Tap to classify</Text>
          </View>
          <View style={{ backgroundColor: pendingCount > 0 ? colors.primaryLight : colors.badgeBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 }}>
            <Text style={{ color: pendingCount > 0 ? colors.primary : colors.subtext, fontWeight: '700', fontSize: 16 }}>{String(pendingCount)}</Text>
          </View>
        </TouchableOpacity>

        {/* Overdue Invoices */}
        {(overdueCount ?? 0) > 0 && (
          <View style={{ backgroundColor: colors.dangerLight, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.danger + '40', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.danger }}>Overdue Invoices</Text>
              <Text style={{ fontSize: 12, color: colors.danger, marginTop: 2, opacity: 0.8 }}>Require attention</Text>
            </View>
            <View style={{ backgroundColor: colors.danger + '30', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 16 }}>{String(overdueCount)}</Text>
            </View>
          </View>
        )}

        {/* Freelancer: Mileage YTD */}
        {mode === 'freelancer' && mileageData && (
          <TouchableOpacity
            onPress={() => router.push('/freelancer/mileage')}
            style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, elevation: 1 }}
          >
            <Text style={{ fontSize: 12, color: colors.subtext, marginBottom: 4 }}>Mileage YTD</Text>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{mileageData.totalKm.toFixed(1)} km</Text>
            <Text style={{ fontSize: 12, color: colors.primary, marginTop: 4 }}>Est. deduction: {fmt(mileageData.deduction)}</Text>
          </TouchableOpacity>
        )}

        {/* Freelancer: Tax Estimate */}
        {mode === 'freelancer' && taxEstimate && (
          <View style={{ backgroundColor: colors.warningLight, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.warning + '40', elevation: 1 }}>
            <Text style={{ fontSize: 12, color: colors.warning, marginBottom: 4 }}>Tax Estimate {new Date().getFullYear()}</Text>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.warning }}>{fmt(taxEstimate.estimated_tax_owing ?? 0)}</Text>
            <Text style={{ fontSize: 11, color: colors.warning, marginTop: 4, opacity: 0.8 }}>Estimate only — consult a tax professional</Text>
          </View>
        )}

        {/* Personal: Budget */}
        {mode === 'personal' && topCategories.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/personal/budget')}
            style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, elevation: 1 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Budget</Text>
            {topCategories.map((cat: any) => {
              const spent = parseFloat(cat.spent_this_month ?? 0);
              const target = parseFloat(cat.monthly_target ?? 0);
              const progress = target > 0 ? Math.min(spent / target, 1) : 0;
              return (
                <View key={cat.id} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cat.color ?? colors.subtext }} />
                      <Text style={{ fontSize: 13, color: colors.text }}>{cat.name}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: progress >= 1 ? colors.danger : colors.subtext }}>
                      {fmt(spent)} / {fmt(target)}
                    </Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3 }}>
                    <View style={{ height: 6, width: `${progress * 100}%`, backgroundColor: progress >= 1 ? colors.danger : (cat.color ?? colors.primary), borderRadius: 3 }} />
                  </View>
                </View>
              );
            })}
          </TouchableOpacity>
        )}

        {/* Personal: Net Worth */}
        {mode === 'personal' && netWorth != null && (
          <TouchableOpacity
            onPress={() => router.push('/personal/net-worth')}
            style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, elevation: 1 }}
          >
            <Text style={{ fontSize: 12, color: colors.subtext, marginBottom: 4 }}>Net Worth</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: totalNetWorth >= 0 ? colors.primary : colors.danger }}>{fmt(totalNetWorth)}</Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
              <Text style={{ fontSize: 12, color: colors.primary }}>Assets {fmt(netWorth.total_assets ?? 0)}</Text>
              <Text style={{ fontSize: 12, color: colors.danger }}>Liabilities {fmt(netWorth.total_liabilities ?? 0)}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
