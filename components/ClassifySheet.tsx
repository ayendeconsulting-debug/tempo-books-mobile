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
import { useTheme } from '../lib/themeContext';
import { RADIUS } from '../lib/tokens';
import Button from './ui/Button';

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
  const { colors } = useTheme();

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
      // API reads businessId from JWT - no query param needed
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
        <View style={{
          backgroundColor: colors.surfaceCardElevated,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: 32,
          maxHeight: '85%',
        }}>
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.borderDefault,
            }} />
          </View>

          {/* Title */}
          <Text style={{
            fontSize: 18,
            lineHeight: 26,
            fontFamily: 'Manrope_600SemiBold',
            fontWeight: '600',
            color: colors.inkPrimary,
            paddingHorizontal: 20,
            paddingBottom: 12,
          }}>
            Classify Transaction
          </Text>

          {/* Account search */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search accounts..."
              placeholderTextColor={colors.inkTertiary}
              style={{
                backgroundColor: colors.surfaceCard,
                borderWidth: 0.5,
                borderColor: colors.borderDefault,
                borderRadius: RADIUS.md,
                paddingHorizontal: 14,
                paddingVertical: 9,
                fontSize: 14,
                fontFamily: 'Manrope_400Regular',
                color: colors.inkPrimary,
              }}
            />
          </View>

          {/* Account list */}
          {loadingAccounts ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ padding: 24 }} />
          ) : (
            <FlatList
              data={filteredAccounts}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 220 }}
              renderItem={({ item }) => {
                const isSelected = selectedAccount?.id === item.id;
                return (
                  <TouchableOpacity
                    onPress={() => setSelectedAccount(item)}
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderBottomWidth: 0.5,
                      borderBottomColor: colors.borderSubtle,
                      backgroundColor: isSelected ? colors.primaryLight : 'transparent',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View>
                      <Text style={{
                        fontSize: 14,
                        fontFamily: 'Manrope_600SemiBold',
                        fontWeight: '600',
                        color: colors.inkPrimary,
                      }}>
                        {item.name}
                      </Text>
                      <Text style={{
                        fontSize: 12,
                        fontFamily: 'Manrope_400Regular',
                        color: colors.inkSecondary,
                        marginTop: 2,
                      }}>
                        {item.account_code} · {item.type}
                      </Text>
                    </View>
                    {isSelected && (
                      <Text style={{
                        color: colors.brandPrimary,
                        fontSize: 16,
                        fontFamily: 'Manrope_700Bold',
                        fontWeight: '700',
                      }}>
                        ✓
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Tax code picker */}
          {(taxCodes ?? []).length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <Text style={{
                fontSize: 13,
                lineHeight: 18,
                fontFamily: 'Manrope_600SemiBold',
                fontWeight: '600',
                color: colors.inkPrimary,
                marginBottom: 8,
              }}>
                Tax Code (optional)
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setSelectedTaxCode(null)}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: RADIUS.pill,
                    borderWidth: 0.5,
                    borderColor: !selectedTaxCode ? colors.brandPrimary : colors.borderDefault,
                    backgroundColor: !selectedTaxCode ? colors.primaryLight : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 13,
                    fontFamily: 'Manrope_600SemiBold',
                    fontWeight: '600',
                    color: !selectedTaxCode ? colors.brandPrimary : colors.inkSecondary,
                  }}>
                    None
                  </Text>
                </TouchableOpacity>
                {(taxCodes ?? []).map((tc: any) => {
                  const isSel = selectedTaxCode?.id === tc.id;
                  return (
                    <TouchableOpacity
                      key={tc.id}
                      onPress={() => setSelectedTaxCode(tc)}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: RADIUS.pill,
                        borderWidth: 0.5,
                        borderColor: isSel ? colors.brandPrimary : colors.borderDefault,
                        backgroundColor: isSel ? colors.primaryLight : 'transparent',
                      }}
                    >
                      <Text style={{
                        fontSize: 13,
                        fontFamily: 'Manrope_600SemiBold',
                        fontWeight: '600',
                        color: isSel ? colors.brandPrimary : colors.inkSecondary,
                        fontVariant: ['tabular-nums'],
                      }}>
                        {tc.code} ({tc.rate}%)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Error */}
          {error ? (
            <Text style={{
              color: colors.accentNegative,
              fontSize: 13,
              fontFamily: 'Manrope_400Regular',
              textAlign: 'center',
              paddingHorizontal: 20,
              paddingTop: 8,
            }}>
              {error}
            </Text>
          ) : null}

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16 }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Cancel"
                onPress={resetAndClose}
                variant="secondary"
                size="md"
                fullWidth
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Classify"
                onPress={() => handleClassify(false)}
                variant="primary"
                size="md"
                fullWidth
                loading={saving}
                disabled={!selectedAccount}
              />
            </View>
          </View>

          {canPost && (
            <View style={{ marginHorizontal: 16, marginTop: 8 }}>
              <Button
                label="Classify & Post"
                onPress={() => handleClassify(true)}
                variant="tertiary"
                size="md"
                fullWidth
                disabled={!selectedAccount}
                loading={saving}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}