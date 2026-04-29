import { useAuth } from '@clerk/clerk-expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ClassifySheet from '../../components/ClassifySheet';
import PersonalCategorySheet from '../../components/PersonalCategorySheet';
import DocumentAttachments from '../../components/DocumentAttachments';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';

const STATUS_COLOR: Record<string, string> = {
  pending: '#D97706',
  classified: '#2563EB',
  posted: '#0F6E56',
  ignored: '#9CA3AF',
  categorized: '#7C3AED',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
      <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 15, color: '#111827', fontWeight: '500' }}>{value}</Text>
    </View>
  );
}

export default function TransactionDetailScreen() {
  const params = useLocalSearchParams();
  const { getToken } = useAuth();
  const { activeBusiness } = useBusiness();
  const router = useRouter();

  const transaction = params.data ? JSON.parse(params.data as string) : null;
  const mode = activeBusiness?.mode ?? 'business';

  const [localStatus, setLocalStatus] = useState<string>(transaction?.status ?? 'pending');
  const [isPersonal, setIsPersonal] = useState<boolean>(transaction?.is_personal ?? false);
  const [categoryName, setCategoryName] = useState<string | null>(transaction?.personal_category?.name ?? null);
  const [classifyVisible, setClassifyVisible] = useState(false);
  const [categoryVisible, setCategoryVisible] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [unclassifying, setUnclassifying] = useState(false);
  const [togglingTag, setTogglingTag] = useState(false);

  if (!transaction) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#9CA3AF' }}>Transaction not found</Text>
      </View>
    );
  }

  const amount = parseFloat(transaction.amount ?? 0);
  const isCredit = amount < 0;

  // Determine display status label
  const displayStatus = mode === 'personal' && transaction.personal_category_id
    ? 'categorized'
    : localStatus;
  const statusColor = STATUS_COLOR[displayStatus] ?? '#9CA3AF';

  // ── Freelancer: toggle Business / Personal tag ──────────────────────
  async function handleToggleTag(markPersonal: boolean) {
    setTogglingTag(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await apiClient.patch(`/classification/raw/${transaction.id}/tag`, {
        is_personal: markPersonal,
      });
      setIsPersonal(markPersonal);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to update tag.');
    } finally {
      setTogglingTag(false);
    }
  }

  // ── Business: post classified transaction ───────────────────────────
  async function handlePost() {
    if (!transaction.source_account_id) {
      Alert.alert('Cannot Post', 'No source account found for this transaction.');
      return;
    }
    Alert.alert('Post Transaction', 'Post this transaction to the ledger?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Post', onPress: async () => {
          setPosting(true);
          try {
            const token = await getToken();
            setAuthToken(token);
            await apiClient.post(`/classification/post/${transaction.id}`, {
              sourceAccountId: transaction.source_account_id,
            });
            setLocalStatus('posted');
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Failed to post transaction.');
          } finally {
            setPosting(false);
          }
        },
      },
    ]);
  }

  // ── Business: unclassify ────────────────────────────────────────────
  async function handleUnclassify() {
    Alert.alert('Unclassify', 'Remove classification from this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unclassify', style: 'destructive', onPress: async () => {
          setUnclassifying(true);
          try {
            const token = await getToken();
            setAuthToken(token);
            await apiClient.delete(`/classification/raw/${transaction.id}/classify`);
            setLocalStatus('pending');
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Failed to unclassify.');
          } finally {
            setUnclassifying(false);
          }
        },
      },
    ]);
  }

  // ── AI Explain ──────────────────────────────────────────────────────
  async function handleAiExplain() {
    setAiLoading(true);
    setAiModalVisible(true);
    setAiText('');
    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await apiClient.post(`/ai/explain/${transaction.id}`);
      setAiText(res.data?.explanation ?? res.data?.message ?? JSON.stringify(res.data));
    } catch (err: any) {
      setAiText(err?.response?.data?.message ?? 'Could not generate explanation.');
    } finally {
      setAiLoading(false);
    }
  }

  // ── Receipt capture ─────────────────────────────────────────────────
  // ── Decide which primary action to show ─────────────────────────────
  // business: classify/post/unclassify
  // personal: categorize
  // freelancer: B/P toggle + then business or personal flow based on tag
  const effectiveMode = mode === 'freelancer'
    ? (isPersonal ? 'personal' : 'business')
    : mode;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header card */}
      <View style={{ backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20, elevation: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
          {transaction.description ?? transaction.raw_description ?? ''}
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: isCredit ? '#0F6E56' : '#111827', marginBottom: 12 }}>
          {isCredit ? '+' : ''}{Math.abs(amount).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <View style={{ backgroundColor: statusColor + '18', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontSize: 13, color: statusColor, fontWeight: '600', textTransform: 'capitalize' }}>{displayStatus}</Text>
          </View>
          {mode === 'freelancer' && (
            <View style={{
              backgroundColor: isPersonal ? '#F3F4F6' : '#EDF7F2',
              borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
            }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: isPersonal ? '#6B7280' : '#0F6E56' }}>
                {isPersonal ? 'Personal' : 'Business'}
              </Text>
            </View>
          )}
          {transaction.anomaly_flags?.length > 0 && (
            <View style={{ backgroundColor: '#FEF3C7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 13, color: '#D97706', fontWeight: '600' }}>⚠ Flagged</Text>
            </View>
          )}
        </View>
      </View>

      {/* Fields */}
      <View style={{ backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, paddingHorizontal: 16, elevation: 1 }}>
        <Field
          label="Date"
          value={transaction.date ? new Date(transaction.date).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
        />
        {transaction.account_name ? <Field label="Classified To" value={transaction.account_name} /> : null}
        {categoryName ? <Field label="Category" value={categoryName} /> : null}
        {transaction.tax_code ? <Field label="Tax Code" value={transaction.tax_code} /> : null}
      </View>

      {/* Receipts (DocumentAttachments - Phase 32b) */}
      <DocumentAttachments
        rawTransactionId={transaction.id}
        transactionAmount={amount}
        transactionDate={transaction.date}
      />

      {/* Actions */}
      <View style={{ marginHorizontal: 16, marginTop: 16, gap: 10 }}>

        {/* Freelancer B/P toggle */}
        {mode === 'freelancer' && localStatus === 'pending' && (
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 12 }}>Tag as</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => handleToggleTag(false)}
                disabled={togglingTag}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
                  backgroundColor: !isPersonal ? '#0F6E56' : '#F3F4F6',
                  borderWidth: 1.5, borderColor: !isPersonal ? '#0F6E56' : '#E5E7EB',
                }}
              >
                {togglingTag && !isPersonal
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontSize: 14, fontWeight: '600', color: !isPersonal ? '#fff' : '#6B7280' }}>Business</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleToggleTag(true)}
                disabled={togglingTag}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
                  backgroundColor: isPersonal ? '#6B7280' : '#F3F4F6',
                  borderWidth: 1.5, borderColor: isPersonal ? '#6B7280' : '#E5E7EB',
                }}
              >
                {togglingTag && isPersonal
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontSize: 14, fontWeight: '600', color: isPersonal ? '#fff' : '#6B7280' }}>Personal</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Business flow: Classify */}
        {effectiveMode === 'business' && localStatus === 'pending' && (
          <TouchableOpacity
            onPress={() => setClassifyVisible(true)}
            style={{ backgroundColor: '#0F6E56', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Classify</Text>
          </TouchableOpacity>
        )}

        {/* Business flow: Post */}
        {effectiveMode === 'business' && localStatus === 'classified' && (
          <TouchableOpacity
            onPress={handlePost}
            disabled={posting}
            style={{ backgroundColor: posting ? '#E5E7EB' : '#0F6E56', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
          >
            {posting
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Post to Ledger</Text>
            }
          </TouchableOpacity>
        )}

        {/* Business flow: Unclassify */}
        {effectiveMode === 'business' && localStatus === 'classified' && (
          <TouchableOpacity
            onPress={handleUnclassify}
            disabled={unclassifying}
            style={{ borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: '#FECACA' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#DC2626' }}>
              {unclassifying ? 'Removing...' : 'Unclassify'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Personal flow: Categorize */}
        {effectiveMode === 'personal' && localStatus !== 'posted' && (
          <TouchableOpacity
            onPress={() => setCategoryVisible(true)}
            style={{ backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
              {transaction.personal_category_id || categoryName ? 'Recategorize' : 'Categorize'}
            </Text>
          </TouchableOpacity>
        )}


        {/* AI Explain */}
        <TouchableOpacity
          onPress={handleAiExplain}
          style={{ borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: '#F5F3FF' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#7C3AED' }}>AI Explain</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />

      {/* Classify Sheet (business flow) */}
      <ClassifySheet
        visible={classifyVisible}
        transactionId={transaction.id}
        sourceAccountId={transaction.source_account_id}
        onClose={() => setClassifyVisible(false)}
        onSuccess={() => setLocalStatus('classified')}
      />

      {/* Personal Category Sheet */}
      <PersonalCategorySheet
        visible={categoryVisible}
        transactionId={transaction.id}
        currentCategoryId={transaction.personal_category_id}
        onClose={() => setCategoryVisible(false)}
        onSuccess={(id, name) => setCategoryName(name)}
      />

      {/* AI Modal */}
      <Modal visible={aiModalVisible} transparent animationType="slide" onRequestClose={() => setAiModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%' }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' }} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>AI Explanation</Text>
            {aiLoading
              ? <ActivityIndicator color="#7C3AED" style={{ padding: 24 }} />
              : <ScrollView><Text style={{ fontSize: 14, color: '#374151', lineHeight: 22 }}>{aiText}</Text></ScrollView>
            }
            <TouchableOpacity
              onPress={() => setAiModalVisible(false)}
              style={{ marginTop: 20, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '600', color: '#374151' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
