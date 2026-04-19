import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';

function fmt(amount: number) {
  return '$' + Math.abs(amount).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NetWorthScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const { colors } = useTheme();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['net-worth', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/personal/net-worth');
      return res.data;
    },
  });

  const totalAssets = parseFloat(data?.total_assets ?? 0);
  const totalLiabilities = parseFloat(data?.total_liabilities ?? 0);
  const netWorth = totalAssets - totalLiabilities;
  const accounts: any[] = data?.accounts ?? data?.items ?? [];
  const assets = accounts.filter((a: any) => parseFloat(a.balance ?? 0) >= 0);
  const liabilities = accounts.filter((a: any) => parseFloat(a.balance ?? 0) < 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}>
        <View style={{ backgroundColor: netWorth >= 0 ? colors.primary : colors.danger, padding: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Net Worth</Text>
          {isLoading ? <ActivityIndicator color="#fff" /> : (
            <Text style={{ fontSize: 36, fontWeight: '800', color: '#fff' }}>{netWorth < 0 ? '-' : ''}{fmt(netWorth)}</Text>
          )}
          <View style={{ flexDirection: 'row', gap: 24, marginTop: 16 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Assets</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{fmt(totalAssets)}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Liabilities</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{fmt(totalLiabilities)}</Text>
            </View>
          </View>
        </View>

        <View style={{ padding: 16, gap: 12 }}>
          {assets.length > 0 && (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', elevation: 1, borderWidth: 1, borderColor: colors.cardBorder }}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.primaryLight }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Assets</Text>
              </View>
              {assets.map((a: any) => (
                <View key={a.id ?? a.name} style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, color: colors.text }}>{a.name ?? a.account_name}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>{fmt(parseFloat(a.balance ?? 0))}</Text>
                </View>
              ))}
            </View>
          )}
          {liabilities.length > 0 && (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', elevation: 1, borderWidth: 1, borderColor: colors.cardBorder }}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.dangerLight }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger, textTransform: 'uppercase', letterSpacing: 0.5 }}>Liabilities</Text>
              </View>
              {liabilities.map((a: any) => (
                <View key={a.id ?? a.name} style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, color: colors.text }}>{a.name ?? a.account_name}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.danger }}>{fmt(Math.abs(parseFloat(a.balance ?? 0)))}</Text>
                </View>
              ))}
            </View>
          )}
          {!isLoading && accounts.length === 0 && (
            <View style={{ padding: 48, alignItems: 'center' }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📈</Text>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>No accounts linked yet</Text>
              <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 4, textAlign: 'center' }}>Connect your bank to see your net worth</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
