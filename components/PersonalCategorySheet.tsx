import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient, setAuthToken } from '../lib/api';
import { useBusiness } from '../lib/businessContext';

interface Props {
  visible: boolean;
  transactionId: string;
  currentCategoryId?: string | null;
  onClose: () => void;
  onSuccess: (categoryId: string | null, categoryName: string | null) => void;
}

export default function PersonalCategorySheet({
  visible, transactionId, currentCategoryId, onClose, onSuccess,
}: Props) {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['budget-categories', activeBusiness?.id],
    enabled: !!activeBusiness?.id && visible,
    queryFn: async () => {
      const token = await getToken();
      setAuthToken(token);
      const res = await apiClient.get('/personal/budget-categories');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  async function handleSelect(categoryId: string | null, categoryName: string | null) {
    setSaving(true);
    setError('');
    try {
      const token = await getToken();
      setAuthToken(token);
      await apiClient.patch(`/personal/transactions/${transactionId}/category`, {
        category_id: categoryId,
      });
      onSuccess(categoryId, categoryName);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to assign category.');
    } finally {
      setSaving(false);
    }
  }

  // Separate income vs expense categories
  const expenseCategories = (categories ?? []).filter((c: any) => c.type !== 'income');
  const incomeCategories = (categories ?? []).filter((c: any) => c.type === 'income');

  function renderCategory(item: any) {
    const isSelected = item.id === currentCategoryId;
    const color = item.color ?? '#9CA3AF';
    return (
      <TouchableOpacity
        onPress={() => handleSelect(item.id, item.name)}
        disabled={saving}
        style={{
          paddingHorizontal: 20, paddingVertical: 13,
          borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
          backgroundColor: isSelected ? '#F0FDF4' : '#fff',
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827', flex: 1 }}>{item.name}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {item.spent_this_month != null && (
            <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
              {parseFloat(item.spent_this_month).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })} this month
            </Text>
          )}
          {isSelected && <Text style={{ color: '#0F6E56', fontSize: 13, fontWeight: '700' }}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, maxHeight: '80%' }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' }} />
          </View>

          <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', paddingHorizontal: 20, paddingBottom: 12 }}>
            Assign Category
          </Text>

          {isLoading ? (
            <ActivityIndicator color="#0F6E56" style={{ padding: 32 }} />
          ) : (
            <FlatList
              data={[
                ...(incomeCategories.length > 0 ? [{ id: '__income_header__', _header: 'Income' }] : []),
                ...incomeCategories,
                ...(expenseCategories.length > 0 ? [{ id: '__expense_header__', _header: 'Expenses' }] : []),
                ...expenseCategories,
              ]}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                if (item._header) {
                  return (
                    <View style={{ paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#F9FAFB' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {item._header}
                      </Text>
                    </View>
                  );
                }
                return renderCategory(item);
              }}
            />
          )}

          {error ? (
            <Text style={{ color: '#DC2626', fontSize: 13, textAlign: 'center', paddingHorizontal: 20, paddingTop: 8 }}>{error}</Text>
          ) : null}

          {/* Footer actions */}
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#6B7280' }}>Cancel</Text>
            </TouchableOpacity>
            {currentCategoryId && (
              <TouchableOpacity
                onPress={() => handleSelect(null, null)}
                disabled={saving}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#FECACA', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#DC2626' }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
