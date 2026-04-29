import { useAuth } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient, setAuthToken } from '../../lib/api';
import { useTheme } from '../../lib/themeContext';
import { RADIUS } from '../../lib/tokens';
import Card from '../../components/ui/Card';
import Pill from '../../components/ui/Pill';
import Button from '../../components/ui/Button';

const WEB_APP = 'https://gettempo.ca';

type PillVariant = 'positive' | 'negative' | 'warning' | 'info' | 'neutral' | 'brand';

const STATUS_VARIANT: Record<string, PillVariant> = {
  draft: 'neutral',
  sent: 'info',
  overdue: 'negative',
  paid: 'positive',
  partial: 'warning',
  void: 'neutral',
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
        fontFamily: 'Manrope_600SemiBold',
        fontWeight: '600',
        color: colors.inkSecondary,
        marginBottom: 2,
      }}>
        {label}
      </Text>
      <Text style={{
        fontSize: 15,
        fontFamily: 'Manrope_600SemiBold',
        fontWeight: '600',
        color: colors.inkPrimary,
      }}>
        {value}
      </Text>
    </View>
  );
}

// Safely parse params.data from the invoices-list navigation fast path.
// Returns null if the param is missing or JSON is malformed -- screen then
// falls back to fetching by id.
function parseDataParam(raw: unknown): any | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function InvoiceDetailScreen() {
  const params = useLocalSearchParams();
  const { getToken } = useAuth();
  const { colors } = useTheme();

  // Fast path: invoices-list passes the full object as a JSON-stringified
  // `data` param. Initialize synchronously so there's no loading flash.
  const initialInvoice = parseDataParam(params.data);

  const [invoice, setInvoice] = useState<any | null>(initialInvoice);
  const [localStatus, setLocalStatus] = useState<string>(initialInvoice?.status ?? 'draft');
  const [loading, setLoading] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<'loaded' | 'loading' | 'notfound'>(
    initialInvoice ? 'loaded' : 'loading',
  );

  // Deep-link fetch path: if we don't already have the invoice from params.data,
  // try to fetch by id (e.g. a push-notification tap lands here with only an id).
  useEffect(() => {
    if (invoice) return;

    const rawId = params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (typeof id !== 'string' || id.length === 0) {
      setFetchStatus('notfound');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const res = await apiClient.get(`/invoices/${id}`);
        if (cancelled) return;
        if (res.data?.id) {
          setInvoice(res.data);
          setLocalStatus(res.data.status ?? 'draft');
          setFetchStatus('loaded');
        } else {
          setFetchStatus('notfound');
        }
      } catch (err: any) {
        if (cancelled) return;
        console.warn('[Invoice] Fetch by id failed:', err?.message ?? err);
        setFetchStatus('notfound');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Loading state -- only shown when we arrived with just an id.
  if (fetchStatus === 'loading') {
    return (
      <View style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceApp,
      }}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  // Not-found state -- fetch errored or no id/data provided.
  if (fetchStatus === 'notfound' || !invoice) {
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
          Invoice not found
        </Text>
      </View>
    );
  }

  const total = parseFloat(invoice.total ?? invoice.subtotal ?? 0);
  const statusVariant: PillVariant = STATUS_VARIANT[localStatus] ?? 'neutral';

  async function handleSend() {
    Alert.alert('Send Invoice', `Mark invoice ${invoice.invoice_number} as sent?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send', onPress: async () => {
          setLoading(true);
          try {
            const token = await getToken();
            setAuthToken(token);
            await apiClient.post(`/invoices/${invoice.id}/send`);
            setLocalStatus('sent');
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Failed to send invoice.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }

  async function handleVoid() {
    Alert.alert('Void Invoice', 'This action cannot be undone. Void this invoice?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Void', style: 'destructive', onPress: async () => {
          setLoading(true);
          try {
            const token = await getToken();
            setAuthToken(token);
            await apiClient.post(`/invoices/${invoice.id}/void`);
            setLocalStatus('void');
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Failed to void invoice.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }

  function handleRecordPayment() {
    // Record Payment requires chart-of-accounts selection -- handled via web app
    Linking.openURL(`${WEB_APP}/invoices/${invoice.id}`);
  }

  function handleDownloadPdf() {
    // PDF requires auth -- open invoice page on web app
    Linking.openURL(`${WEB_APP}/invoices/${invoice.id}`);
  }

  const lineItems = invoice.line_items ?? [];
  const isPaid = localStatus === 'paid';
  const showPaymentAction = localStatus === 'sent' || localStatus === 'overdue' || localStatus === 'partial';
  const canVoid = localStatus === 'draft' || localStatus === 'sent';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceApp }}>
      {/* Header */}
      <Card padding="prominent" style={{ margin: 16 }}>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        }}>
          <Text style={{
            fontSize: 18,
            lineHeight: 26,
            fontFamily: 'Manrope_600SemiBold',
            fontWeight: '600',
            color: colors.inkPrimary,
          }}>
            {invoice.invoice_number ?? 'Invoice'}
          </Text>
          <Pill variant={statusVariant} size="md">
            {capitalize(localStatus)}
          </Pill>
        </View>
        <Text style={{
          fontSize: 28,
          lineHeight: 34,
          fontFamily: 'Manrope_700Bold',
          fontWeight: '700',
          color: isPaid ? colors.accentPositive : colors.inkPrimary,
          fontVariant: ['tabular-nums'],
        }}>
          {total.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
        </Text>
      </Card>

      {/* Details - inline View not <Card> because the divider-list pattern wants no top padding */}
      <View style={{
        backgroundColor: colors.surfaceCard,
        marginHorizontal: 16,
        borderRadius: RADIUS.lg,
        paddingHorizontal: 16,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
      }}>
        <Field label="Client" value={invoice.client_name ?? ''} />
        {invoice.client_email ? <Field label="Email" value={invoice.client_email} /> : null}
        {invoice.issue_date ? (
          <Field
            label="Issue Date"
            value={new Date(invoice.issue_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
          />
        ) : null}
        {invoice.due_date ? (
          <Field
            label="Due Date"
            value={new Date(invoice.due_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
          />
        ) : null}
        {invoice.notes ? <Field label="Notes" value={invoice.notes} /> : null}
      </View>

      {/* Line items */}
      {lineItems.length > 0 && (
        <Card padding="default" style={{ marginHorizontal: 16, marginTop: 12 }}>
          <Text style={{
            fontSize: 14,
            fontFamily: 'Manrope_700Bold',
            fontWeight: '700',
            color: colors.inkPrimary,
            marginBottom: 12,
          }}>
            Line Items
          </Text>
          {lineItems.map((item: any, idx: number) => (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                paddingVertical: 8,
                borderBottomWidth: idx < lineItems.length - 1 ? 0.5 : 0,
                borderBottomColor: colors.borderSubtle,
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{
                  fontSize: 14,
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                  color: colors.inkPrimary,
                }}>
                  {item.description}
                </Text>
                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Manrope_400Regular',
                  color: colors.inkSecondary,
                  marginTop: 2,
                  fontVariant: ['tabular-nums'],
                }}>
                  {item.quantity} x {parseFloat(item.unit_price).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
                </Text>
              </View>
              <Text style={{
                fontSize: 14,
                fontFamily: 'Manrope_600SemiBold',
                fontWeight: '600',
                color: colors.inkPrimary,
                fontVariant: ['tabular-nums'],
              }}>
                {(item.quantity * item.unit_price).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Actions */}
      <View style={{ marginHorizontal: 16, marginTop: 16, gap: 10 }}>
        {loading && <ActivityIndicator color={colors.brandPrimary} style={{ padding: 8 }} />}

        {localStatus === 'draft' && !loading && (
          <Button
            label="Mark as Sent"
            onPress={handleSend}
            variant="primary"
            size="lg"
            fullWidth
          />
        )}

        {showPaymentAction && !loading && (
          <Button
            label="Record Payment"
            onPress={handleRecordPayment}
            variant="primary"
            size="lg"
            fullWidth
          />
        )}

        <Button
          label="View / Download PDF"
          onPress={handleDownloadPdf}
          variant="secondary"
          size="lg"
          fullWidth
        />

        {canVoid && !loading && (
          <TouchableOpacity
            onPress={handleVoid}
            activeOpacity={0.7}
            style={{
              borderRadius: RADIUS.md,
              paddingVertical: 13,
              alignItems: 'center',
              borderWidth: 0.5,
              borderColor: colors.accentNegative,
              backgroundColor: 'transparent',
            }}
          >
            <Text style={{
              fontSize: 14,
              fontFamily: 'Manrope_600SemiBold',
              fontWeight: '600',
              color: colors.accentNegative,
            }}>
              Void Invoice
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}