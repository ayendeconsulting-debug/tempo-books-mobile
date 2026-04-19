import { useAuth } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';

const API_BASE = 'https://ayende-bookkeeping-mvp-production.up.railway.app';
const WEB_APP = 'https://gettempo.ca';

const STATUS_COLOR: Record<string, string> = {
  draft: '#9CA3AF',
  sent: '#2563EB',
  overdue: '#DC2626',
  paid: '#0F6E56',
  partial: '#D97706',
  void: '#6B7280',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
      <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 15, color: '#111827', fontWeight: '500' }}>{value}</Text>
    </View>
  );
}

export default function InvoiceDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const invoice = params.data ? JSON.parse(params.data as string) : null;
  const [localStatus, setLocalStatus] = useState<string>(invoice?.status ?? 'draft');
  const [loading, setLoading] = useState(false);

  if (!invoice) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#9CA3AF' }}>Invoice not found</Text>
      </View>
    );
  }

  const total = parseFloat(invoice.total ?? invoice.subtotal ?? 0);
  const statusColor = STATUS_COLOR[localStatus] ?? '#9CA3AF';

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
    // Record Payment requires chart-of-accounts selection — handled via web app
    Linking.openURL(`${WEB_APP}/invoices/${invoice.id}`);
  }

  function handleDownloadPdf() {
    // PDF requires auth — open invoice page on web app
    Linking.openURL(`${WEB_APP}/invoices/${invoice.id}`);
  }

  const lineItems = invoice.line_items ?? [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20, elevation: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
            {invoice.invoice_number ?? 'Invoice'}
          </Text>
          <View style={{ backgroundColor: statusColor + '18', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontSize: 13, color: statusColor, fontWeight: '600', textTransform: 'capitalize' }}>{localStatus}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 28, fontWeight: '800', color: localStatus === 'paid' ? '#0F6E56' : '#111827' }}>
          {total.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
        </Text>
      </View>

      {/* Details */}
      <View style={{ backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, paddingHorizontal: 16, elevation: 1 }}>
        <Field label="Client" value={invoice.client_name ?? ''} />
        {invoice.client_email ? <Field label="Email" value={invoice.client_email} /> : null}
        {invoice.issue_date ? (
          <Field label="Issue Date" value={new Date(invoice.issue_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })} />
        ) : null}
        {invoice.due_date ? (
          <Field label="Due Date" value={new Date(invoice.due_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })} />
        ) : null}
        {invoice.notes ? <Field label="Notes" value={invoice.notes} /> : null}
      </View>

      {/* Line items */}
      {lineItems.length > 0 && (
        <View style={{ backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16, elevation: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12 }}>Line Items</Text>
          {lineItems.map((item: any, idx: number) => (
            <View key={idx} style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
              paddingVertical: 8,
              borderBottomWidth: idx < lineItems.length - 1 ? 1 : 0,
              borderBottomColor: '#F3F4F6',
            }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 14, color: '#111827', fontWeight: '500' }}>{item.description}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  {item.quantity} x {parseFloat(item.unit_price).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                {(item.quantity * item.unit_price).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={{ marginHorizontal: 16, marginTop: 16, gap: 10 }}>
        {loading && <ActivityIndicator color="#0F6E56" style={{ padding: 8 }} />}

        {localStatus === 'draft' && !loading && (
          <TouchableOpacity
            onPress={handleSend}
            style={{ backgroundColor: '#0F6E56', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Mark as Sent</Text>
          </TouchableOpacity>
        )}

        {(localStatus === 'sent' || localStatus === 'overdue' || localStatus === 'partial') && !loading && (
          <TouchableOpacity
            onPress={handleRecordPayment}
            style={{ backgroundColor: '#0F6E56', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Record Payment</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleDownloadPdf}
          style={{ borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>View / Download PDF</Text>
        </TouchableOpacity>

        {(localStatus === 'draft' || localStatus === 'sent') && !loading && (
          <TouchableOpacity
            onPress={handleVoid}
            style={{ borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: '#FECACA' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#DC2626' }}>Void Invoice</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}
