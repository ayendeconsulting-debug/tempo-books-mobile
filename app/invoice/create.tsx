import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';

function today() {
  return new Date().toISOString().split('T')[0];
}

function in30days() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

interface LineItem {
  description: string;
  quantity: string;
  unit_price: string;
}

function InputField({
  label, value, onChangeText, placeholder, keyboardType = 'default', required = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  required?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
        {label}{required ? ' *' : ''}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? ''}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={{
          backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
          borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827',
        }}
      />
    </View>
  );
}

export default function CreateInvoiceScreen() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(in30days());
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: '1', unit_price: '' },
  ]);
  const [saving, setSaving] = useState(false);

  function updateLineItem(idx: number, field: keyof LineItem, value: string) {
    setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function addLineItem() {
    setLineItems(prev => [...prev, { description: '', quantity: '1', unit_price: '' }]);
  }

  function removeLineItem(idx: number) {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  }

  function calcTotal() {
    return lineItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  }

  async function handleCreate() {
    if (!clientName.trim()) {
      Alert.alert('Required', 'Client name is required.');
      return;
    }
    if (!issueDate || !dueDate) {
      Alert.alert('Required', 'Issue date and due date are required.');
      return;
    }
    const validItems = lineItems.filter(i => i.description.trim() && parseFloat(i.unit_price) > 0);
    if (validItems.length === 0) {
      Alert.alert('Required', 'Add at least one line item with a description and price.');
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await apiClient.post('/invoices', {
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || undefined,
        issue_date: issueDate,
        due_date: dueDate,
        notes: notes.trim() || undefined,
        line_items: validItems.map((item, idx) => ({
          description: item.description.trim(),
          quantity: parseFloat(item.quantity) || 1,
          unit_price: parseFloat(item.unit_price),
          sort_order: idx,
        })),
      });
      Alert.alert('Invoice Created', 'Your invoice has been created successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to create invoice.');
    } finally {
      setSaving(false);
    }
  }

  const total = calcTotal();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: '#F9FAFB' }} keyboardShouldPersistTaps="handled">
        {/* Client */}
        <View style={{ backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 16, elevation: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 }}>Client Details</Text>
          <InputField label="Client Name" value={clientName} onChangeText={setClientName} placeholder="Acme Corp" required />
          <InputField label="Client Email" value={clientEmail} onChangeText={setClientEmail} placeholder="client@example.com" keyboardType="email-address" />
        </View>

        {/* Dates */}
        <View style={{ backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 16, elevation: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 }}>Dates</Text>
          <InputField label="Issue Date" value={issueDate} onChangeText={setIssueDate} placeholder="YYYY-MM-DD" required />
          <InputField label="Due Date" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" required />
        </View>

        {/* Line items */}
        <View style={{ backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 16, elevation: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 }}>Line Items</Text>
          {lineItems.map((item, idx) => (
            <View key={idx} style={{
              borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, marginBottom: 10,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>Item {idx + 1}</Text>
                {lineItems.length > 1 && (
                  <TouchableOpacity onPress={() => removeLineItem(idx)}>
                    <Text style={{ color: '#DC2626', fontSize: 13, fontWeight: '600' }}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                value={item.description}
                onChangeText={(v) => updateLineItem(idx, 'description', v)}
                placeholder="Description"
                placeholderTextColor="#9CA3AF"
                style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: '#111827', marginBottom: 8 }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Qty</Text>
                  <TextInput
                    value={item.quantity}
                    onChangeText={(v) => updateLineItem(idx, 'quantity', v)}
                    keyboardType="decimal-pad"
                    style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: '#111827' }}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Unit Price</Text>
                  <TextInput
                    value={item.unit_price}
                    onChangeText={(v) => updateLineItem(idx, 'unit_price', v)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: '#111827' }}
                  />
                </View>
              </View>
              {parseFloat(item.quantity) > 0 && parseFloat(item.unit_price) > 0 && (
                <Text style={{ fontSize: 12, color: '#0F6E56', fontWeight: '600', marginTop: 6, textAlign: 'right' }}>
                  {(parseFloat(item.quantity) * parseFloat(item.unit_price)).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
                </Text>
              )}
            </View>
          ))}

          <TouchableOpacity
            onPress={addLineItem}
            style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D1D5DB', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
          >
            <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 14 }}>+ Add Line Item</Text>
          </TouchableOpacity>
        </View>

        {/* Notes */}
        <View style={{ backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 16, elevation: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Payment terms, thank you note, etc."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
              borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
              fontSize: 14, color: '#111827', minHeight: 80, textAlignVertical: 'top',
            }}
          />
        </View>

        {/* Total + Submit */}
        <View style={{ backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 16, elevation: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Total</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F6E56' }}>
              {total.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleCreate}
            disabled={saving}
            style={{ backgroundColor: saving ? '#E5E7EB' : '#0F6E56', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Create Invoice</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
