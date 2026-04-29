import { useAuth } from '@clerk/clerk-expo';
import { useLocalSearchParams } from 'expo-router';
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
import ClassifySheet from '../../components/ClassifySheet';
import PersonalCategorySheet from '../../components/PersonalCategorySheet';
import DocumentAttachments from '../../components/DocumentAttachments';
import Card from '../../components/ui/Card';
import Pill from '../../components/ui/Pill';
import Button from '../../components/ui/Button';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';
import { RADIUS } from '../../lib/tokens';

type PillVariant = 'positive' | 'negative' | 'warning' | 'info' | 'neutral' | 'brand';

const STATUS_VARIANT: Record<string, PillVariant> = {
  pending: 'warning',
  classified: 'info',
  posted: 'positive',
  ignored: 'neutral',
  categorized: 'info',
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Field({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.borderSubtle,
    }}>
      <Text style={{
        fontSize: 12,
        color: colors.inkSecondary,
        marginBottom: 2,
        fontFamily: 'Manrope_600SemiBold',
        fontWeight: '600',
      }}>{label}</Text>
      <Text style={{
        fontSize: 15,
        color: colors.inkPrimary,
        fontWeight: '600',
        fontFamily: 'Manrope_600SemiBold',
      }}>{value}</Text>
    </View>
  );
}

export default function TransactionDetailScreen() {
  const params = useLocalSearchParams();
  const { getToken } = useAuth();
  const { activeBusiness } = useBusiness();
  const { colors } = useTheme();

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
      <View style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceApp,
      }}>
        <Text style={{
          color: colors.inkSecondary,
          fontFamily: 'Manrope_400Regular',
        }}>
          Transaction not found
        </Text>
      </View>
    );
  }

  const amount = parseFloat(transaction.amount ?? 0);
  const isCredit = amount < 0;

  const displayStatus = mode === 'personal' && transaction.personal_category_id
    ? 'categorized'
    : localStatus;
  const statusPillVariant: PillVariant = STATUS_VARIANT[displayStatus] ?? 'neutral';

  // Toggle Business/Personal tag (freelancer mode)
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

  // Post classified transaction (business flow)
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

  // Unclassify (business flow)
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

  // AI Explain
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

  // Decide which primary action to show
  // business: classify/post/unclassify
  // personal: categorize
  // freelancer: B/P toggle then business or personal flow based on tag
  const effectiveMode = mode === 'freelancer'
    ? (isPersonal ? 'personal' : 'business')
    : mode;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceApp }}>
      {/* Header card */}
      <Card padding="default" style={{ margin: 16 }}>
        <Text style={{
          fontSize: 18,
          lineHeight: 26,
          fontWeight: '600',
          fontFamily: 'Manrope_600SemiBold',
          color: colors.inkPrimary,
          marginBottom: 4,
        }}>
          {transaction.description ?? transaction.raw_description ?? ''}
        </Text>
        <Text style={{
          fontSize: 28,
          lineHeight: 34,
          fontWeight: '700',
          fontFamily: 'Manrope_700Bold',
          color: isCredit ? colors.accentPositive : colors.inkPrimary,
          marginBottom: 12,
          fontVariant: ['tabular-nums'],
        }}>
          {isCredit ? '+' : ''}{Math.abs(amount).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Pill variant={statusPillVariant} size="md">
            {capitalize(displayStatus)}
          </Pill>
          {mode === 'freelancer' && (
            <Pill variant={isPersonal ? 'neutral' : 'brand'} size="md">
              {isPersonal ? 'Personal' : 'Business'}
            </Pill>
          )}
          {transaction.anomaly_flags?.length > 0 && (
            <Pill variant="warning" size="md">
              Flagged
            </Pill>
          )}
        </View>
      </Card>

      {/* Fields - inline View with surfaceCard, not Card primitive (Card adds vertical padding the divider list does not want) */}
      <View style={{
        backgroundColor: colors.surfaceCard,
        marginHorizontal: 16,
        borderRadius: RADIUS.lg,
        paddingHorizontal: 16,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
      }}>
        <Field
          label="Date"
          value={transaction.date ? new Date(transaction.date).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
        />
        {transaction.account_name ? <Field label="Classified To" value={transaction.account_name} /> : null}
        {categoryName ? <Field label="Category" value={categoryName} /> : null}
        {transaction.tax_code ? <Field label="Tax Code" value={transaction.tax_code} /> : null}
      </View>

      {/* Receipts (DocumentAttachments - Phase 32b; restyle scheduled for 32c.4.3) */}
      <DocumentAttachments
        rawTransactionId={transaction.id}
        transactionAmount={amount}
        transactionDate={transaction.date}
      />

      {/* Actions */}
      <View style={{ marginHorizontal: 16, marginTop: 16, gap: 10 }}>

        {/* Freelancer Business/Personal toggle */}
        {mode === 'freelancer' && localStatus === 'pending' && (
          <Card padding="compact">
            <Text style={{
              fontSize: 13,
              fontWeight: '600',
              fontFamily: 'Manrope_600SemiBold',
              color: colors.inkPrimary,
              marginBottom: 12,
            }}>
              Tag as
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                label="Business"
                onPress={() => handleToggleTag(false)}
                variant={!isPersonal ? 'primary' : 'secondary'}
                size="md"
                fullWidth
                loading={togglingTag && !isPersonal}
                style={{ flex: 1 }}
              />
              <Button
                label="Personal"
                onPress={() => handleToggleTag(true)}
                variant={isPersonal ? 'primary' : 'secondary'}
                size="md"
                fullWidth
                loading={togglingTag && isPersonal}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        )}

        {/* Business flow: Classify */}
        {effectiveMode === 'business' && localStatus === 'pending' && (
          <Button
            label="Classify"
            onPress={() => setClassifyVisible(true)}
            variant="primary"
            size="lg"
            fullWidth
          />
        )}

        {/* Business flow: Post */}
        {effectiveMode === 'business' && localStatus === 'classified' && (
          <Button
            label="Post to Ledger"
            onPress={handlePost}
            variant="primary"
            size="lg"
            fullWidth
            loading={posting}
          />
        )}

        {/* Business flow: Unclassify (destructive - inline TouchableOpacity, Button has no destructive variant yet) */}
        {effectiveMode === 'business' && localStatus === 'classified' && (
          <TouchableOpacity
            onPress={handleUnclassify}
            disabled={unclassifying}
            activeOpacity={0.7}
            style={{
              paddingVertical: 13,
              borderRadius: RADIUS.md,
              alignItems: 'center',
              borderWidth: 0.5,
              borderColor: colors.accentNegative,
              backgroundColor: 'transparent',
              opacity: unclassifying ? 0.5 : 1,
            }}
          >
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              fontFamily: 'Manrope_600SemiBold',
              color: colors.accentNegative,
            }}>
              {unclassifying ? 'Removing...' : 'Unclassify'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Personal flow: Categorize */}
        {effectiveMode === 'personal' && localStatus !== 'posted' && (
          <Button
            label={transaction.personal_category_id || categoryName ? 'Recategorize' : 'Categorize'}
            onPress={() => setCategoryVisible(true)}
            variant="primary"
            size="lg"
            fullWidth
          />
        )}

        {/* AI Explain (always available) */}
        <Button
          label="AI Explain"
          onPress={handleAiExplain}
          variant="tertiary"
          size="md"
          fullWidth
        />
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
        <View style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}>
          <View style={{
            backgroundColor: colors.surfaceCardElevated,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: '60%',
          }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.borderDefault,
              }} />
            </View>
            <Text style={{
              fontSize: 16,
              fontWeight: '700',
              fontFamily: 'Manrope_700Bold',
              color: colors.inkPrimary,
              marginBottom: 12,
            }}>
              AI Explanation
            </Text>
            {aiLoading
              ? <ActivityIndicator color={colors.brandPrimary} style={{ padding: 24 }} />
              : <ScrollView>
                  <Text style={{
                    fontSize: 14,
                    lineHeight: 22,
                    fontFamily: 'Manrope_400Regular',
                    color: colors.inkPrimary,
                  }}>
                    {aiText}
                  </Text>
                </ScrollView>
            }
            <View style={{ marginTop: 20 }}>
              <Button
                label="Close"
                onPress={() => setAiModalVisible(false)}
                variant="secondary"
                size="md"
                fullWidth
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}