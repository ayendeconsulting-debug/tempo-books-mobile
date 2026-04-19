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

export default function SavingsGoalsScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { colors } = useTheme();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: goals, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['savings-goals', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get('/personal/savings-goals');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  function openAdd() { setEditing(null); setName(''); setTargetAmount(''); setCurrentAmount('0'); setTargetDate(''); setError(''); setModalVisible(true); }
  function openEdit(goal: any) { setEditing(goal); setName(goal.name); setTargetAmount(String(goal.target_amount ?? '')); setCurrentAmount(String(goal.current_amount ?? '0')); setTargetDate(goal.target_date ? goal.target_date.split('T')[0] : ''); setError(''); setModalVisible(true); }

  async function handleSave() {
    if (!name.trim() || !targetAmount) { setError('Name and target amount are required.'); return; }
    const target = parseFloat(targetAmount);
    if (isNaN(target) || target <= 0) { setError('Enter a valid target amount.'); return; }
    setSaving(true); setError('');
    try {
      const token = await getToken(); setAuthToken(token);
      const body = { name: name.trim(), target_amount: target, current_amount: parseFloat(currentAmount) || 0, target_date: targetDate || undefined };
      if (editing) { await apiClient.patch(`/personal/savings-goals/${editing.id}`, body); }
      else { await apiClient.post('/personal/savings-goals', body); }
      qc.invalidateQueries({ queryKey: ['savings-goals', activeBusiness?.id] });
      setModalVisible(false);
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Failed to save.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(goal: any) {
    Alert.alert('Delete Goal', `Delete "${goal.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const token = await getToken(); setAuthToken(token);
          await apiClient.delete(`/personal/savings-goals/${goal.id}`);
          qc.invalidateQueries({ queryKey: ['savings-goals', activeBusiness?.id] });
        } catch { Alert.alert('Error', 'Failed to delete.'); }
      }},
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Savings Goals</Text>
        <TouchableOpacity onPress={openAdd} style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 }}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={goals ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const current = parseFloat(item.current_amount ?? 0);
            const target = parseFloat(item.target_amount ?? 0);
            const progress = target > 0 ? Math.min(current / target, 1) : 0;
            const pct = Math.round(progress * 100);
            const daysLeft = item.target_date ? Math.ceil((new Date(item.target_date).getTime() - Date.now()) / 86400000) : null;
            return (
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, elevation: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 }}>{item.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity onPress={() => openEdit(item)}><Text style={{ fontSize: 12, color: '#2563EB' }}>Edit</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)}><Text style={{ fontSize: 12, color: colors.danger }}>Delete</Text></TouchableOpacity>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, color: colors.subtext }}>${current.toFixed(0)} saved</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: pct >= 100 ? colors.primary : colors.text }}>{pct}% of ${target.toFixed(0)}</Text>
                </View>
                <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4 }}>
                  <View style={{ height: 8, width: `${pct}%`, backgroundColor: pct >= 100 ? colors.primary : '#3B82F6', borderRadius: 4 }} />
                </View>
                {daysLeft != null && (
                  <Text style={{ fontSize: 11, color: daysLeft < 30 ? colors.danger : colors.placeholder, marginTop: 8 }}>
                    {daysLeft > 0 ? `${daysLeft} days remaining` : daysLeft === 0 ? 'Due today' : 'Past due date'}
                  </Text>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<View style={{ padding: 48, alignItems: 'center' }}><Text style={{ fontSize: 32, marginBottom: 8 }}>🎯</Text><Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>No savings goals yet</Text></View>}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
              <View style={{ alignItems: 'center', marginBottom: 16 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.divider }} /></View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 20 }}>{editing ? 'Edit Goal' : 'New Savings Goal'}</Text>
              {[
                { label: 'Goal Name *', value: name, setter: setName, placeholder: 'e.g. Emergency Fund' },
                { label: 'Target Amount *', value: targetAmount, setter: setTargetAmount, placeholder: '5000.00', keyboardType: 'decimal-pad' as const },
                { label: 'Current Amount', value: currentAmount, setter: setCurrentAmount, placeholder: '0.00', keyboardType: 'decimal-pad' as const },
                { label: 'Target Date (optional)', value: targetDate, setter: setTargetDate, placeholder: 'YYYY-MM-DD' },
              ].map(({ label, value, setter, placeholder, keyboardType }) => (
                <View key={label} style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.subtext, marginBottom: 4 }}>{label}</Text>
                  <TextInput value={value} onChangeText={setter} placeholder={placeholder} placeholderTextColor={colors.placeholder}
                    keyboardType={keyboardType ?? 'default'}
                    style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }} />
                </View>
              ))}
              {error ? <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 8 }}>{error}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.divider, alignItems: 'center' }}>
                  <Text style={{ fontWeight: '600', color: colors.subtext }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: saving ? colors.badgeBg : colors.primary, alignItems: 'center' }}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: '700', color: '#fff' }}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
