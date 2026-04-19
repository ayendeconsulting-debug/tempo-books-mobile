import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient, setAuthToken } from '../lib/api';
import { useBusiness } from '../lib/businessContext';

interface Props {
  visible: boolean;
  transactionId: string;
  sourceAccountId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ClassifySheet({ visible, transactionId, sourceAccountId, onClose, onSuccess }: Props) {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [selectedTaxCode, setSelectedTaxCode] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts', activeBusiness?.id],
    enabled: !!activeBusiness?.id && visible,
    queryFn: async () => {
      const token = await getToken();
      setAuthToken(token);
      // API reads businessId from JWT — no query param needed
      const res = await apiClient.get('/accounts');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  const { data: taxCodes } = useQuery({
    queryKey: ['tax-codes', activeBusiness?.id],
    enabled: !!activeBusiness?.id && visible,
    queryFn: async () => {
      const token = await getToken();
      setAuthToken(token);
      const res = await apiClient.get('/tax-codes');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  const filteredAccounts = (accounts ?? []).filter((a: any) =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.account_code?.toLowerCase().includes(search.toLowerCase())
  );

  function resetAndClose() {
    setSelectedAccount(null);
    setSelectedTaxCode(null);
    setSearch('');
    setError('');
    onClose();
  }

  async function handleClassify(andPost = false) {
    if (!selectedAccount) return;
    setSaving(true);
    setError('');
    try {
      const token = await getToken();
      setAuthToken(token);

      // Correct endpoint: POST /classification/classify
      await apiClient.post('/classification/classify', {
        rawTransactionId: transactionId,
        accountId: selectedAccount.id,
        taxCodeId: selectedTaxCode?.id ?? null,
      });

      if (andPost && sourceAccountId) {
        // Correct endpoint: POST /classification/post/:id
        await apiClient.post(`/classification/post/${transactionId}`, {
          sourceAccountId,
        });
      }

      onSuccess();
      resetAndClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to classify. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const canPost = !!sourceAccountId;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={resetAndClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, maxHeight: '85%' }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' }} />
          </View>

          <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', paddingHorizontal: 20, paddingBottom: 12 }}>
            Classify Transaction
          </Text>

          {/* Account search */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search accounts..."
              placeholderTextColor="#9CA3AF"
              style={{ backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14 }}
            />
          </View>

          {loadingAccounts ? (
            <ActivityIndicator color="#0F6E56" style={{ padding: 24 }} />
          ) : (
            <FlatList
              data={filteredAccounts}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 220 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setSelectedAccount(item)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                    backgroundColor: selectedAccount?.id === item.id ? '#EDF7F2' : '#fff',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827' }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{item.account_code} · {item.type}</Text>
                  </View>
                  {selectedAccount?.id === item.id && (
                    <Text style={{ color: '#0F6E56', fontSize: 16, fontWeight: '700' }}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          )}

          {/* Tax code picker */}
          {(taxCodes ?? []).length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Tax Code (optional)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setSelectedTaxCode(null)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                    borderWidth: 1,
                    borderColor: !selectedTaxCode ? '#0F6E56' : '#E5E7EB',
                    backgroundColor: !selectedTaxCode ? '#EDF7F2' : '#fff',
                  }}
                >
                  <Text style={{ fontSize: 13, color: !selectedTaxCode ? '#0F6E56' : '#6B7280' }}>None</Text>
                </TouchableOpacity>
                {(taxCodes ?? []).map((tc: any) => (
                  <TouchableOpacity
                    key={tc.id}
                    onPress={() => setSelectedTaxCode(tc)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                      borderWidth: 1,
                      borderColor: selectedTaxCode?.id === tc.id ? '#0F6E56' : '#E5E7EB',
                      backgroundColor: selectedTaxCode?.id === tc.id ? '#EDF7F2' : '#fff',
                    }}
                  >
                    <Text style={{ fontSize: 13, color: selectedTaxCode?.id === tc.id ? '#0F6E56' : '#6B7280' }}>
                      {tc.code} ({tc.rate}%)
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {error ? (
            <Text style={{ color: '#DC2626', fontSize: 13, textAlign: 'center', paddingHorizontal: 20, paddingTop: 8 }}>{error}</Text>
          ) : null}

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16 }}>
            <TouchableOpacity
              onPress={resetAndClose}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#6B7280' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleClassify(false)}
              disabled={!selectedAccount || saving}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: selectedAccount ? '#0F6E56' : '#E5E7EB', alignItems: 'center' }}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Classify</Text>
              )}
            </TouchableOpacity>
          </View>

          {canPost && (
            <TouchableOpacity
              onPress={() => handleClassify(true)}
              disabled={!selectedAccount || saving}
              style={{ marginHorizontal: 16, marginTop: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: selectedAccount ? '#EDF7F2' : '#F9FAFB', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: selectedAccount ? '#0F6E56' : '#9CA3AF' }}>Classify & Post</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
