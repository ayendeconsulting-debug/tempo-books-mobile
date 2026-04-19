import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal,
  Platform, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';

const COLORS = ['#EF4444','#F97316','#EAB308','#22C55E','#0F6E56','#3B82F6','#8B5CF6','#EC4899','#14B8A6','#6B7280'];

export default function CategoriesScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { colors } = useTheme();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState('');
  const [categoryType, setCategoryType] = useState<'expense' | 'income'>('expense');
  const [monthlyTarget, setMonthlyTarget] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const { data: categories, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['budget-categories', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/personal/budget-categories');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  function openAdd() {
    setEditing(null); setName(''); setCategoryType('expense'); setMonthlyTarget(''); setColor(COLORS[0]); setError('');
    setModalVisible(true);
  }

  function openEdit(cat: any) {
    setEditing(cat); setName(cat.name);
    setCategoryType(cat.category_type ?? cat.type ?? 'expense');
    setMonthlyTarget(cat.monthly_target ? String(cat.monthly_target) : '');
    setColor(cat.color ?? COLORS[0]); setError('');
    setModalVisible(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    try {
      const token = await getToken(); setAuthToken(token);
      const body = { name: name.trim(), category_type: categoryType, monthly_target: monthlyTarget ? parseFloat(monthlyTarget) : undefined, color };
      if (editing) { await apiClient.patch(`/personal/budget-categories/${editing.id}`, body); }
      else { await apiClient.post('/personal/budget-categories', body); }
      qc.invalidateQueries({ queryKey: ['budget-categories', activeBusiness?.id] });
      setModalVisible(false);
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Failed to save.'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!editing) return;
    Alert.alert('Delete Category', `Delete "${editing.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setDeleting(true);
        try {
          const token = await getToken(); setAuthToken(token);
          await apiClient.delete(`/personal/budget-categories/${editing.id}`);
          qc.invalidateQueries({ queryKey: ['budget-categories', activeBusiness?.id] });
          setModalVisible(false);
        } catch { Alert.alert('Error', 'Failed to delete.'); }
        finally { setDeleting(false); }
      }},
    ]);
  }

  const expenseCategories = (categories ?? []).filter((c: any) => (c.category_type ?? c.type) !== 'income');
  const incomeCategories = (categories ?? []).filter((c: any) => (c.category_type ?? c.type) === 'income');
  const listData = [
    ...(incomeCategories.length > 0 ? [{ id: '__ih__', _header: 'Income' }] : []),
    ...incomeCategories,
    ...(expenseCategories.length > 0 ? [{ id: '__eh__', _header: 'Expenses' }] : []),
    ...expenseCategories,
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Categories</Text>
        <TouchableOpacity onPress={openAdd} style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 }}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={listData}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
            renderItem={({ item }) => {
              if (item._header) {
                return <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.background }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.subtext, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item._header}</Text>
                </View>;
              }
              const spent = parseFloat(item.spent_this_month ?? 0);
              const target = parseFloat(item.monthly_target ?? 0);
              const progress = target > 0 ? Math.min(spent / target, 1) : 0;
              return (
                <TouchableOpacity onPress={() => openEdit(item)} activeOpacity={0.7}
                  style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: item.color ?? colors.subtext, marginRight: 14 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{item.name}</Text>
                    {target > 0 && (
                      <View style={{ marginTop: 6 }}>
                        <View style={{ height: 5, backgroundColor: colors.border, borderRadius: 3 }}>
                          <View style={{ height: 5, width: `${progress * 100}%`, backgroundColor: progress >= 1 ? colors.danger : (item.color ?? colors.primary), borderRadius: 3 }} />
                        </View>
                        <Text style={{ fontSize: 12, color: progress >= 1 ? colors.danger : colors.placeholder, marginTop: 3 }}>
                          ${spent.toFixed(0)} / ${target.toFixed(0)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 20, color: colors.placeholder, marginLeft: 8 }}>›</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: 48, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🏷️</Text>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>No categories yet</Text>
                <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 4 }}>Tap + Add to create one</Text>
              </View>
            }
          />
        </View>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' }}>
              <View style={{ alignItems: 'center', paddingTop: 12 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.divider }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 4 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{editing ? 'Edit Category' : 'Add Category'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ fontSize: 15, color: colors.subtext }}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtext, marginBottom: 6 }}>Name *</Text>
                <TextInput value={name} onChangeText={setName} placeholder="e.g. Groceries" placeholderTextColor={colors.placeholder}
                  style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, marginBottom: 18 }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtext, marginBottom: 8 }}>Type</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                  {(['expense', 'income'] as const).map((t) => (
                    <TouchableOpacity key={t} onPress={() => setCategoryType(t)}
                      style={{ flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', backgroundColor: categoryType === t ? colors.primary : colors.badgeBg }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: categoryType === t ? '#fff' : colors.subtext, textTransform: 'capitalize' }}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtext, marginBottom: 6 }}>Monthly Target (optional)</Text>
                <TextInput value={monthlyTarget} onChangeText={setMonthlyTarget} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={colors.placeholder}
                  style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, marginBottom: 18 }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.subtext, marginBottom: 10 }}>Color</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {COLORS.map((c) => (
                    <TouchableOpacity key={c} onPress={() => setColor(c)}
                      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: color === c ? 3 : 1.5, borderColor: color === c ? colors.text : 'transparent' }} />
                  ))}
                </View>
                {error ? <Text style={{ color: colors.danger, fontSize: 13, marginTop: 14 }}>{error}</Text> : null}
              </ScrollView>
              <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, gap: 10 }}>
                <TouchableOpacity onPress={handleSave} disabled={saving}
                  style={{ paddingVertical: 15, borderRadius: 14, backgroundColor: saving ? colors.badgeBg : colors.primary, alignItems: 'center' }}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{editing ? 'Save Changes' : 'Add Category'}</Text>}
                </TouchableOpacity>
                {editing && (
                  <TouchableOpacity onPress={handleDelete} disabled={deleting}
                    style={{ paddingVertical: 15, borderRadius: 14, borderWidth: 1.5, borderColor: colors.danger + '60', alignItems: 'center' }}>
                    {deleting ? <ActivityIndicator color={colors.danger} /> : <Text style={{ fontSize: 15, fontWeight: '600', color: colors.danger }}>Delete Category</Text>}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
