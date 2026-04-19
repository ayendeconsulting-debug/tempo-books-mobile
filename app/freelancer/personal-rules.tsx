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

const MATCH_TYPES = ['keyword', 'vendor'] as const;
const MATCH_COLOR: Record<string, string> = { keyword: '#2563EB', vendor: '#7C3AED' };

export default function PersonalRulesScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { colors } = useTheme();

  const [modalVisible, setModalVisible] = useState(false);
  const [matchType, setMatchType] = useState<'keyword' | 'vendor'>('keyword');
  const [matchValue, setMatchValue] = useState('');
  const [catSearch, setCatSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const { data: rules, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['personal-rules', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/personal/rules');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  // Always fetch categories — needed for client-side join since API returns no relations
  const { data: categories } = useQuery({
    queryKey: ['budget-categories', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/personal/budget-categories');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  // Build lookup map: id -> category
  const categoryMap: Record<string, any> = {};
  (categories ?? []).forEach((c: any) => { categoryMap[c.id] = c; });

  const filteredCategories = (categories ?? []).filter((c: any) =>
    c.name?.toLowerCase().includes(catSearch.toLowerCase())
  );

  function openAdd() {
    setMatchType('keyword'); setMatchValue('');
    setCatSearch(''); setSelectedCategory(null); setError('');
    setModalVisible(true);
  }

  async function handleSave() {
    if (!matchValue.trim()) { setError('Match value is required.'); return; }
    if (!selectedCategory) { setError('Select a category.'); return; }
    setSaving(true); setError('');
    try {
      const token = await getToken(); setAuthToken(token);
      await apiClient.post('/personal/rules', {
        match_type: matchType, match_value: matchValue.trim(), budget_category_id: selectedCategory.id,
      });
      qc.invalidateQueries({ queryKey: ['personal-rules', activeBusiness?.id] });
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
          await apiClient.delete(`/personal/rules/${rule.id}`);
          qc.invalidateQueries({ queryKey: ['personal-rules', activeBusiness?.id] });
        } catch (err: any) { Alert.alert('Error', err?.response?.data?.message ?? 'Failed to delete.'); }
      }},
    ]);
  }

  async function handleToggleActive(rule: any) {
    try {
      const token = await getToken(); setAuthToken(token);
      await apiClient.patch(`/personal/rules/${rule.id}`, { is_active: !rule.is_active });
      qc.invalidateQueries({ queryKey: ['personal-rules', activeBusiness?.id] });
    } catch { Alert.alert('Error', 'Failed to update rule.'); }
  }

  async function handleRunRules() {
    Alert.alert('Run Rules', 'Apply personal rules to uncategorized transactions?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Run', onPress: async () => {
        setRunning(true);
        try {
          const token = await getToken(); setAuthToken(token);
          const res = await apiClient.post('/personal/rules/run');
          const count = res.data?.categorized ?? res.data?.count ?? 0;
          Alert.alert('Rules Applied', `${count} transaction(s) categorized.`);
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
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Personal Rules</Text>
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
            renderItem={({ item }) => {
              // Client-side join: look up category from cached budget categories
              const cat = item.budget_category ?? categoryMap[item.budget_category_id];
              return (
                <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: item.is_active === false ? 0.5 : 1 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <View style={{ backgroundColor: (MATCH_COLOR[item.match_type] ?? '#9CA3AF') + '18', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, color: MATCH_COLOR[item.match_type] ?? colors.subtext, fontWeight: '600', textTransform: 'capitalize' }}>{item.match_type}</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{item.match_value}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {cat?.color && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cat.color }} />}
                      <Text style={{ fontSize: 12, color: colors.subtext }}>→ {cat?.name ?? 'Unknown category'}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => handleToggleActive(item)}>
                      <Text style={{ fontSize: 12, color: item.is_active === false ? colors.primary : colors.subtext }}>
                        {item.is_active === false ? 'Enable' : 'Disable'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)}>
                      <Text style={{ fontSize: 13, color: colors.danger }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: 48, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>No personal rules yet</Text>
                <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 4, textAlign: 'center' }}>Rules auto-categorize matching transactions</Text>
              </View>
            }
          />
        </View>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' }}>
              <View style={{ alignItems: 'center', paddingTop: 12 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.divider }} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 16 }}>Add Personal Rule</Text>

              <View style={{ paddingHorizontal: 24 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.subtext, marginBottom: 8 }}>Match Type</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {MATCH_TYPES.map((t) => (
                    <TouchableOpacity key={t} onPress={() => setMatchType(t)}
                      style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: matchType === t ? colors.primary : colors.badgeBg }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: matchType === t ? '#fff' : colors.subtext, textTransform: 'capitalize' }}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.subtext, marginBottom: 4 }}>Match Value *</Text>
                <TextInput value={matchValue} onChangeText={setMatchValue} placeholder="e.g. Spotify, Tim Hortons" placeholderTextColor={colors.placeholder}
                  style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, marginBottom: 14 }} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.subtext, marginBottom: 4 }}>Assign to Category *</Text>
                <TextInput value={catSearch} onChangeText={setCatSearch} placeholder="Search categories..." placeholderTextColor={colors.placeholder}
                  style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, marginBottom: 6 }} />
                {selectedCategory && (
                  <View style={{ backgroundColor: colors.primaryLight, borderRadius: 10, padding: 10, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {selectedCategory.color && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: selectedCategory.color }} />}
                    <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>✓ {selectedCategory.name}</Text>
                  </View>
                )}
              </View>

              <FlatList
                data={filteredCategories.slice(0, 6)}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 160, marginHorizontal: 24 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => { setSelectedCategory(item); setCatSearch(''); }}
                    style={{ paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {item.color && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />}
                    <Text style={{ fontSize: 13, color: colors.text }}>{item.name}</Text>
                  </TouchableOpacity>
                )}
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
