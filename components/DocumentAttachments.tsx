import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@clerk/clerk-expo';
import { setAuthToken } from '../lib/api';
import { useAiFeatureAccess } from '../lib/useSubscription';
import {
  DocumentRecord,
  ExtractResult,
  getDocumentsForTransaction,
  requestPresignedUpload,
  registerDocument,
  startReceiptExtract,
  pollExtractJob,
  deleteDocument,
} from '../lib/documents';
import { useTheme } from '../lib/themeContext';
import { RADIUS } from '../lib/tokens';
import Card from './ui/Card';
import Pill from './ui/Pill';
import Button from './ui/Button';

const MAX_POLLS = 12;       // 12 x 2s = 24s ceiling, matches web
const POLL_INTERVAL = 2000;
const CONFIDENCE_THRESHOLD = 0.5;
const AMOUNT_TOLERANCE = 0.01;
const DATE_TOLERANCE_DAYS = 1;

type ExtractState =
  | { status: 'idle' }
  | { status: 'extracting' }
  | { status: 'complete'; result: ExtractResult }
  | { status: 'low_confidence' }
  | { status: 'failed'; message: string };

interface Props {
  rawTransactionId: string;
  transactionAmount?: number;
  transactionDate?: string;
}

function dayDiff(isoA: string, isoB: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoA) || !/^\d{4}-\d{2}-\d{2}$/.test(isoB)) return NaN;
  const [ay, am, ad] = isoA.split('-').map(Number);
  const [by, bm, bd] = isoB.split('-').map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.abs(Math.round((a - b) / 86400000));
}

function formatExtractedDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatExtractedAmount(amount: number, currency: string): string {
  const formatted = amount.toFixed(2);
  return currency ? currency + ' ' + formatted : formatted;
}

export default function DocumentAttachments({ rawTransactionId, transactionAmount, transactionDate }: Props) {
  const { getToken } = useAuth();
  const { hasAccess: canExtract } = useAiFeatureAccess();
  const { colors } = useTheme();

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractStates, setExtractStates] = useState<Record<string, ExtractState>>({});

  async function loadDocuments() {
    try {
      const token = await getToken();
      setAuthToken(token);
      const docs = await getDocumentsForTransaction(rawTransactionId);
      setDocuments(docs);
    } catch (err) {
      console.warn('[DocumentAttachments] load failed', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, [rawTransactionId]);

  async function handleCapture() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const fileName = asset.fileName ?? 'receipt_' + Date.now() + '.jpg';
    const fileType = fileName.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
    const fileSizeBytes = asset.fileSize ?? 500000;

    setUploading(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const presigned = await requestPresignedUpload({
        fileName, fileType, fileSizeBytes, rawTransactionId,
      });

      const imageRes = await fetch(asset.uri);
      const blob = await imageRes.blob();
      await fetch(presigned.url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/' + fileType },
      });

      const doc = await registerDocument({
        s3Key: presigned.key,
        s3Bucket: presigned.bucket,
        fileName, fileType, fileSizeBytes,
        rawTransactionId,
      });

      setDocuments((prev) => [doc, ...prev]);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.response?.data?.message ?? err?.message ?? 'Could not upload receipt.');
    } finally {
      setUploading(false);
    }
  }

  async function handleExtract(doc: DocumentRecord) {
    setExtractStates((prev) => ({ ...prev, [doc.id]: { status: 'extracting' } }));
    try {
      const token = await getToken();
      setAuthToken(token);
      const enq = await startReceiptExtract(doc.id);
      const finalStatus = await pollExtractJob(enq.job_id, POLL_INTERVAL, MAX_POLLS * POLL_INTERVAL);

      if (finalStatus.status === 'failed') {
        setExtractStates((prev) => ({
          ...prev,
          [doc.id]: { status: 'failed', message: 'AI extraction failed - please try again' },
        }));
        return;
      }

      const result = finalStatus.result;
      if (!result || typeof result.confidence !== 'number') {
        setExtractStates((prev) => ({
          ...prev,
          [doc.id]: { status: 'failed', message: 'AI returned no result' },
        }));
        return;
      }

      if (result.confidence < CONFIDENCE_THRESHOLD) {
        setExtractStates((prev) => ({ ...prev, [doc.id]: { status: 'low_confidence' } }));
      } else {
        setExtractStates((prev) => ({ ...prev, [doc.id]: { status: 'complete', result } }));
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Could not extract receipt.';
      setExtractStates((prev) => ({
        ...prev,
        [doc.id]: { status: 'failed', message: msg },
      }));
    }
  }

  function handleResetExtract(documentId: string) {
    setExtractStates((prev) => ({ ...prev, [documentId]: { status: 'idle' } }));
  }

  async function handleDelete(doc: DocumentRecord) {
    Alert.alert('Remove receipt', doc.file_name + ' will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            const token = await getToken();
            setAuthToken(token);
            await deleteDocument(doc.id);
            setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
            setExtractStates((prev) => {
              const next = { ...prev };
              delete next[doc.id];
              return next;
            });
          } catch (err: any) {
            Alert.alert('Delete failed', err?.response?.data?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  }

  // Style helpers - reused inline across the file
  const overlineStyle = {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold' as const,
    fontWeight: '600' as const,
    color: colors.inkSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  };

  const resetLinkStyle = {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold' as const,
    fontWeight: '600' as const,
    color: colors.inkSecondary,
  };

  function renderExtractCard(doc: DocumentRecord) {
    const state = extractStates[doc.id] ?? { status: 'idle' };
    if (state.status === 'idle' || state.status === 'extracting') return null;

    if (state.status === 'failed') {
      return (
        <Card accent="negative" padding="compact" style={{ marginTop: 8 }}>
          <Text style={[overlineStyle, { color: colors.accentNegative, marginBottom: 4 }]}>
            Extract failed
          </Text>
          <Text style={{
            fontSize: 12,
            fontFamily: 'Manrope_400Regular',
            color: colors.inkPrimary,
            marginBottom: 6,
          }}>
            {state.message}
          </Text>
          <TouchableOpacity onPress={() => handleResetExtract(doc.id)} activeOpacity={0.7}>
            <Text style={resetLinkStyle}>Reset</Text>
          </TouchableOpacity>
        </Card>
      );
    }

    if (state.status === 'low_confidence') {
      return (
        <Card accent="warning" padding="compact" style={{ marginTop: 8 }}>
          <Text style={[overlineStyle, { color: colors.accentWarning, marginBottom: 4 }]}>
            Low confidence
          </Text>
          <Text style={{
            fontSize: 12,
            fontFamily: 'Manrope_400Regular',
            color: colors.inkPrimary,
            marginBottom: 6,
          }}>
            AI could not read this receipt clearly. Try a clearer photo if needed.
          </Text>
          <TouchableOpacity onPress={() => handleResetExtract(doc.id)} activeOpacity={0.7}>
            <Text style={resetLinkStyle}>Reset</Text>
          </TouchableOpacity>
        </Card>
      );
    }

    const r = state.result;
    const hasAmountMismatch =
      typeof transactionAmount === 'number' && r.amount !== null &&
      Math.abs(Math.abs(transactionAmount) - r.amount) > AMOUNT_TOLERANCE;
    const hasDateMismatch =
      typeof transactionDate === 'string' && r.date !== null &&
      !Number.isNaN(dayDiff(transactionDate.slice(0, 10), r.date)) &&
      dayDiff(transactionDate.slice(0, 10), r.date) > DATE_TOLERANCE_DAYS;
    const hasMismatch = hasAmountMismatch || hasDateMismatch;
    const hasComparison = typeof transactionAmount === 'number' || typeof transactionDate === 'string';

    return (
      <Card accent="positive" padding="compact" style={{ marginTop: 8 }}>
        <Text style={[overlineStyle, { color: colors.accentPositive, marginBottom: 6 }]}>
          AI Extracted
        </Text>
        <Text style={{
          fontSize: 13,
          fontFamily: 'Manrope_600SemiBold',
          fontWeight: '600',
          color: colors.inkPrimary,
          marginBottom: 4,
        }}>
          {r.vendor || 'Unknown vendor'}
        </Text>
        <Text style={{
          fontSize: 12,
          fontFamily: 'Manrope_400Regular',
          color: colors.inkSecondary,
          marginBottom: 4,
          fontVariant: ['tabular-nums'],
        }}>
          {r.amount !== null ? formatExtractedAmount(r.amount, r.currency || '') : '-'}
          {r.date ? '  -  ' + formatExtractedDate(r.date) : ''}
        </Text>

        {hasComparison && !hasMismatch && (
          <Text style={{
            fontSize: 11,
            fontFamily: 'Manrope_400Regular',
            color: colors.accentPositive,
            marginTop: 4,
          }}>
            Matches transaction
          </Text>
        )}

        {hasAmountMismatch && (
          <Text style={{
            fontSize: 11,
            fontFamily: 'Manrope_400Regular',
            color: colors.accentWarning,
            marginTop: 4,
            fontVariant: ['tabular-nums'],
          }}>
            Amount differs from bank ({formatExtractedAmount(Math.abs(transactionAmount as number), r.currency || '')} bank, {formatExtractedAmount(r.amount as number, r.currency || '')} receipt)
          </Text>
        )}

        {hasDateMismatch && (
          <Text style={{
            fontSize: 11,
            fontFamily: 'Manrope_400Regular',
            color: colors.accentWarning,
            marginTop: 4,
          }}>
            Date differs from bank (bank: {formatExtractedDate((transactionDate as string).slice(0, 10))}, receipt: {formatExtractedDate(r.date as string)})
          </Text>
        )}

        <TouchableOpacity onPress={() => handleResetExtract(doc.id)} style={{ marginTop: 8 }} activeOpacity={0.7}>
          <Text style={resetLinkStyle}>Reset</Text>
        </TouchableOpacity>
      </Card>
    );
  }

  function renderDocument(doc: DocumentRecord) {
    const state = extractStates[doc.id] ?? { status: 'idle' };
    const isImage = ['jpg', 'jpeg', 'png'].includes(doc.file_type.toLowerCase());

    return (
      <Card key={doc.id} padding="compact" style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pill
            variant={isImage ? 'info' : 'negative'}
            size="md"
            style={{
              width: 40,
              height: 40,
              borderRadius: RADIUS.md,
              paddingVertical: 0,
              paddingHorizontal: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isImage ? 'IMG' : 'PDF'}
          </Pill>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 13,
              fontFamily: 'Manrope_600SemiBold',
              fontWeight: '600',
              color: colors.inkPrimary,
            }} numberOfLines={1}>
              {doc.file_name}
            </Text>
            <Text style={{
              fontSize: 11,
              fontFamily: 'Manrope_400Regular',
              color: colors.inkSecondary,
              marginTop: 2,
              fontVariant: ['tabular-nums'],
            }}>
              {(doc.file_size_bytes / 1024).toFixed(0)} KB
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleDelete(doc)} style={{ padding: 6 }} activeOpacity={0.7}>
            <Text style={{
              fontSize: 14,
              fontFamily: 'Manrope_600SemiBold',
              fontWeight: '600',
              color: colors.accentNegative,
            }}>
              Remove
            </Text>
          </TouchableOpacity>
        </View>

        {canExtract && state.status === 'idle' && (
          <View style={{ marginTop: 10 }}>
            <Button
              label="Extract with AI"
              onPress={() => handleExtract(doc)}
              variant="primary"
              size="sm"
              fullWidth
            />
          </View>
        )}

        {state.status === 'extracting' && (
          <View style={{
            marginTop: 10,
            paddingVertical: 10,
            borderRadius: RADIUS.md,
            backgroundColor: colors.surfaceCardElevated,
            borderWidth: 0.5,
            borderColor: colors.borderSubtle,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}>
            <ActivityIndicator color={colors.brandPrimary} size="small" />
            <Text style={{
              fontSize: 12,
              fontFamily: 'Manrope_600SemiBold',
              fontWeight: '600',
              color: colors.inkSecondary,
            }}>
              Extracting...
            </Text>
          </View>
        )}

        {renderExtractCard(doc)}
      </Card>
    );
  }

  return (
    <Card padding="default" style={{ marginHorizontal: 16, marginTop: 16 }}>
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <Text style={overlineStyle}>
          Receipts {documents.length > 0 ? '(' + documents.length + ')' : ''}
        </Text>
        <Button
          label="Add Receipt"
          onPress={handleCapture}
          variant="primary"
          size="sm"
          loading={uploading}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ paddingVertical: 16 }} />
      ) : documents.length === 0 ? (
        <Text style={{
          fontSize: 12,
          fontFamily: 'Manrope_400Regular',
          color: colors.inkTertiary,
          textAlign: 'center',
          paddingVertical: 16,
        }}>
          No receipts attached. Add one to track expenses.
        </Text>
      ) : (
        documents.map(renderDocument)
      )}
    </Card>
  );
}