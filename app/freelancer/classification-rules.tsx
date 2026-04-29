import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';
import { RADIUS } from '../../lib/tokens';
import Pill from '../../components/ui/Pill';
import Button from '../../components/ui/Button';

const MATCH_TYPES = ['keyword', 'vendor', 'account'] as const;

type PillVariant = 'positive' | 'negative' | 'warning' | 'info' | 'neutral' | 'brand';

const MATCH_VARIANT: Record<string, PillVariant> = {
  keyword: 'info',
  vendor: 'brand',
  account: 'positive',
};

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

  const inputStyle = {
    backgroundColor: colors.inputBg,
    borderWidth: 0.5,
    borderColor: colors.borderDefault,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Manrope_400Regular' as const,
    color: colors.inkPrimary,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceApp }}>
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
          Classification Rules
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label="▶ Run"
            onPress={handleRunRules}
            variant="tertiary"
            size="sm"
            loading={running}
          />
          <Button
            label="+ Add"
            onPress={openAdd}
            variant="primary"
            size="sm"
          />
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={rules ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
            renderItem={({ item }) => (
              <View style={{
                backgroundColor: colors.surfaceCard,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.borderSubtle,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Pill variant={MATCH_VARIANT[item.match_type] ?? 'neutral'} size="sm">
                      {item.match_type.charAt(0).toUpperCase() + item.match_type.slice(1)}
                    </Pill>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Manrope_600SemiBold',
                      fontWeight: '600',
                      color: colors.inkPrimary,
                    }}>
                      {item.match_value}
                    </Text>
                  </View>
                  <Text style={{
                    fontSize: 12,
                    fontFamily: 'Manrope_400Regular',
                    color: colors.inkSecondary,
                  }}>
                    → {item._accountName ?? 'No account assigned'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item)} activeOpacity={0.7}>
                  <Text style={{
                    fontSize: 13,
                    fontFamily: 'Manrope_600SemiBold',
                    fontWeight: '600',
                    color: colors.accentNegative,
                  }}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <View style={{ padding: 48, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>⚡</Text>
                <Text style={{
                  color: colors.inkPrimary,
                  fontSize: 15,
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                }}>
                  No rules yet
                </Text>
                <Text style={{
                  color: colors.inkSecondary,
                  fontSize: 13,
                  fontFamily: 'Manrope_400Regular',
                  marginTop: 4,
                }}>
                  Rules auto-classify matching transactions
                </Text>
              </View>
            }
          />
        </View>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <View style={{
              backgroundColor: colors.surfaceCardElevated,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '90%',
            }}>
              <View style={{ alignItems: 'center', paddingTop: 12 }}>
                <View style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.borderDefault,
                }} />
              </View>
              <Text style={{
                fontSize: 18,
                lineHeight: 26,
                fontFamily: 'Manrope_600SemiBold',
                fontWeight: '600',
                color: colors.inkPrimary,
                paddingHorizontal: 24,
                paddingTop: 14,
                paddingBottom: 16,
              }}>
                Add Rule
              </Text>

              <View style={{ paddingHorizontal: 24 }}>
                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                  color: colors.inkSecondary,
                  marginBottom: 8,
                }}>
                  Match Type
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {MATCH_TYPES.map((t) => {
                    const isActive = matchType === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setMatchType(t)}
                        activeOpacity={0.7}
                        style={{
                          flex: 1,
                          paddingVertical: 9,
                          borderRadius: RADIUS.sm,
                          alignItems: 'center',
                          borderWidth: 0.5,
                          borderColor: isActive ? colors.brandPrimary : colors.borderDefault,
                          backgroundColor: isActive ? colors.primaryLight : 'transparent',
                        }}
                      >
                        <Text style={{
                          fontSize: 12,
                          fontFamily: 'Manrope_600SemiBold',
                          fontWeight: '600',
                          color: isActive ? colors.brandPrimary : colors.inkSecondary,
                          textTransform: 'capitalize',
                        }}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                  color: colors.inkSecondary,
                  marginBottom: 4,
                }}>
                  Match Value *
                </Text>
                <TextInput
                  value={matchValue}
                  onChangeText={setMatchValue}
                  placeholder="e.g. Netflix, LCBO"
                  placeholderTextColor={colors.inkTertiary}
                  style={[inputStyle, { marginBottom: 14 }]}
                />

                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                  color: colors.inkSecondary,
                  marginBottom: 6,
                }}>
                  Assign to Account *
                </Text>
                {selectedAccount && (
                  <View style={{
                    backgroundColor: colors.primaryLight,
                    borderRadius: RADIUS.md,
                    padding: 12,
                    marginBottom: 8,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Manrope_600SemiBold',
                      fontWeight: '600',
                      color: colors.brandPrimary,
                    }}>
                      ✓ {accountLabel(selectedAccount)}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedAccount(null)} activeOpacity={0.7}>
                      <Text style={{
                        fontSize: 12,
                        fontFamily: 'Manrope_400Regular',
                        color: colors.inkSecondary,
                      }}>
                        Change
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TextInput
                  value={accountSearch}
                  onChangeText={setAccountSearch}
                  placeholder="Search accounts..."
                  placeholderTextColor={colors.inkTertiary}
                  style={[inputStyle, { marginBottom: 4 }]}
                />
              </View>

              <FlatList
                data={filteredAccounts}
                keyExtractor={(item) => item.id}
                style={{
                  maxHeight: 200,
                  marginHorizontal: 24,
                  backgroundColor: colors.surfaceCard,
                  borderRadius: RADIUS.md,
                }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = selectedAccount?.id === item.id;
                  const label = accountLabel(item);
                  return (
                    <TouchableOpacity
                      onPress={() => { setSelectedAccount(item); setAccountSearch(''); }}
                      activeOpacity={0.7}
                      style={{
                        paddingVertical: 14,
                        paddingHorizontal: 14,
                        borderBottomWidth: 0.5,
                        borderBottomColor: colors.borderSubtle,
                        backgroundColor: isSelected ? colors.primaryLight : 'transparent',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          fontSize: 14,
                          fontFamily: isSelected ? 'Manrope_600SemiBold' : 'Manrope_400Regular',
                          fontWeight: isSelected ? '600' : '400',
                          color: isSelected ? colors.brandPrimary : colors.inkPrimary,
                        }}>
                          {label}
                        </Text>
                        <Text style={{
                          fontSize: 11,
                          fontFamily: 'Manrope_400Regular',
                          color: colors.inkSecondary,
                          marginTop: 1,
                        }}>
                          {item.account_code}{item.type ? ` · ${item.type}` : ''}
                        </Text>
                      </View>
                      {isSelected && (
                        <Text style={{
                          color: colors.brandPrimary,
                          fontFamily: 'Manrope_700Bold',
                          fontWeight: '700',
                          marginLeft: 8,
                        }}>
                          ✓
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />

              {error ? (
                <Text style={{
                  color: colors.accentNegative,
                  fontSize: 13,
                  fontFamily: 'Manrope_400Regular',
                  paddingHorizontal: 24,
                  paddingTop: 8,
                }}>
                  {error}
                </Text>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 10, padding: 24, paddingTop: 16 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Cancel"
                    onPress={() => setModalVisible(false)}
                    variant="secondary"
                    size="md"
                    fullWidth
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Button
                    label="Save Rule"
                    onPress={handleSave}
                    variant="primary"
                    size="md"
                    fullWidth
                    loading={saving}
                  />
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}