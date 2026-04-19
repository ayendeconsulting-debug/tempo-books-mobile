import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal,
  Platform, RefreshControl, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';

const MATCH_TYPES = ['keyword', 'vendor', 'account'] as const;
const MATCH_COLOR: Record<string, string> = { keyword: '#2563EB', vendor: '#7C3AED', account: '#0F6E56' };

export default function ClassificationRulesScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { colors } = useTheme();

  const [modalVisible, setModalVisible] = useState(false);
  const [matchType, setMatchType] = useState<'keyword' | 'vendor' | 'account'>('keyword');
  const [matchValue, setMatchValue] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const { data: rules, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['classification-rules', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      // Fetch rules and accounts in parallel, join account name at query time
      const [rulesRes, accountsRes] = await Promise.all([
        apiClient.get('/classification/rules'),
        apiClient.get('/accounts'),
      ]);
      const rulesList = Array.isArray(rulesRes.data) ? rulesRes.data : rulesRes.data?.data ?? [];
      const accountsList = Array.isArray(accountsRes.data) ? accountsRes.data : [];
      const accountMap: Record<string, any> = {};
      accountsList.forEach((a: any) => { accountMap[a.id] = a; });
      const getLabel = (a: any) => (a?.name && a.name.trim()) ? a.name : (a?.account_code ?? null);
      return rulesList.map((rule: any) => ({
        ...rule,
        _accountName: getLabel(rule.targetAccount) ?? getLabel(accountMap[rule.target_account_id]) ?? null,
      }));
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/accounts');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  // Build display name: prefer name, fall back to account_code
  function accountLabel(a: any): string {
    return (a?.name && a.name.trim()) ? a.name : (a?.account_code ?? 'Unknown');
  }

  const filteredAccounts = (accounts ?? []).filter((a: any) =>
    !accountSearch.trim() ||
    accountLabel(a).toLowerCase().includes(accountSearch.toLowerCase()) ||
    a.account_code?.toLowerCase().includes(accountSearch.toLowerCase())
  );

  function openAdd() {
    setMatchType('keyword'); setMatchValue('');
    setAccountSearch(''); setSelectedAccount(null); setError('');
    setModalVisible(true);
  }

  async function handleSave() {
    if (!matchValue.trim()) { setError('Match value is required.'); return; }
    if (!selectedAccount) { setError('Select an account.'); return; }
    setSaving(true); setError('');
    try {
      const token = await getToken(); setAuthToken(token);
      await apiClient.post('/classification/rules', {
        match_type: matchType, match_value: matchValue.trim(), target_account_id: selectedAccount.id,
      });
      qc.invalidateQueries({ queryKey: ['classification-rules', activeBusiness?.id] });
      setModalVisible(false);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save rule.');
    } finally { setSaving(false); }
  }

  async function handleDelete(rule: any) {
    Alert.alert('Delete Rule', `Delete rule for "${rule.match_value}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const token = await getToken(); setAuthToken(token);
          await apiClient.delete(`/classification/rules/${rule.id}`);
          qc.invalidateQueries({ queryKey: ['classification-rules', activeBusiness?.id] });
        } catch (err: any) { Alert.alert('Error', err?.response?.data?.message ?? 'Failed to delete.'); }
      }},
    ]);
  }

  async function handleRunRules() {
    Alert.alert('Run Rules', 'Apply all rules to pending transactions?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Run', onPress: async () => {
        setRunning(true);
        try {
          const token = await getToken(); setAuthToken(token);
          const res = await apiClient.post('/classification/rules/run-batch');
          const count = res.data?.classified ?? res.data?.count ?? 0;
          Alert.alert('Rules Applied', `${count} transaction(s) classified.`);
          qc.invalidateQueries({ queryKey: ['transactions'] });
        } catch (err: any) {
          Alert.alert('Error', err?.response?.data?.message ?? 'Failed to run rules.');
        } finally { setRunning(false); }
      }},
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Classification Rules</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={handleRunRules} disabled={running}
            style={{ backgroundColor: colors.primaryLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }}>
            {running ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>▶ Run</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={openAdd} style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={rules ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
            renderItem={({ item }) => (
              <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <View style={{ backgroundColor: (MATCH_COLOR[item.match_type] ?? '#9CA3AF') + '18', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, color: MATCH_COLOR[item.match_type] ?? colors.subtext, fontWeight: '600', textTransform: 'capitalize' }}>{item.match_type}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{item.match_value}</Text>
                  </View>
                  {/* Account name joined at query time */}
                  <Text style={{ fontSize: 12, color: colors.subtext }}>
                    → {item._accountName ?? 'No account assigned'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item)}>
                  <Text style={{ fontSize: 13, color: colors.danger }}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <View style={{ padding: 48, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>⚡</Text>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>No rules yet</Text>
                <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 4 }}>Rules auto-classify matching transactions</Text>
              </View>
            }
          />
        </View>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }}>
              <View style={{ alignItems: 'center', paddingTop: 12 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.divider }} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 16 }}>Add Rule</Text>

              <View style={{ paddingHorizontal: 24 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.subtext, marginBottom: 8 }}>Match Type</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {MATCH_TYPES.map((t) => (
                    <TouchableOpacity key={t} onPress={() => setMatchType(t)}
                      style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: matchType === t ? colors.primary : colors.badgeBg }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: matchType === t ? '#fff' : colors.subtext, textTransform: 'capitalize' }}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.subtext, marginBottom: 4 }}>Match Value *</Text>
                <TextInput value={matchValue} onChangeText={setMatchValue} placeholder="e.g. Netflix, LCBO" placeholderTextColor={colors.placeholder}
                  style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, marginBottom: 14 }} />

                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.subtext, marginBottom: 6 }}>Assign to Account *</Text>
                {selectedAccount && (
                  <View style={{ backgroundColor: colors.primaryLight, borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>✓ {accountLabel(selectedAccount)}</Text>
                    <TouchableOpacity onPress={() => setSelectedAccount(null)}>
                      <Text style={{ fontSize: 12, color: colors.subtext }}>Change</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TextInput value={accountSearch} onChangeText={setAccountSearch} placeholder="Search accounts..." placeholderTextColor={colors.placeholder}
                  style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.text, marginBottom: 4 }} />
              </View>

              <FlatList
                data={filteredAccounts}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 200, marginHorizontal: 24, backgroundColor: colors.card, borderRadius: 10 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = selectedAccount?.id === item.id;
                  const label = accountLabel(item);
                  return (
                    <TouchableOpacity onPress={() => { setSelectedAccount(item); setAccountSearch(''); }}
                      style={{ paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: isSelected ? colors.primaryLight : colors.card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? '600' : '400' }}>{label}</Text>
                        <Text style={{ fontSize: 11, color: colors.subtext, marginTop: 1 }}>
                          {item.account_code}{item.type ? ` · ${item.type}` : ''}
                        </Text>
                      </View>
                      {isSelected && <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 8 }}>✓</Text>}
                    </TouchableOpacity>
                  );
                }}
              />

              {error ? <Text style={{ color: colors.danger, fontSize: 13, paddingHorizontal: 24, paddingTop: 8 }}>{error}</Text> : null}

              <View style={{ flexDirection: 'row', gap: 10, padding: 24, paddingTop: 16 }}>
                <TouchableOpacity onPress={() => setModalVisible(false)}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.divider, alignItems: 'center' }}>
                  <Text style={{ fontWeight: '600', color: colors.subtext }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={saving}
                  style={{ flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: saving ? colors.badgeBg : colors.primary, alignItems: 'center' }}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '700', color: '#fff' }}>Save Rule</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
