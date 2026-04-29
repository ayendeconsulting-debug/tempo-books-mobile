import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient, setAuthToken } from '../../lib/api';
import { useTheme } from '../../lib/themeContext';
import { RADIUS } from '../../lib/tokens';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

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
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{
        fontSize: 13,
        fontFamily: 'Manrope_600SemiBold',
        fontWeight: '600',
        color: colors.inkPrimary,
        marginBottom: 6,
      }}>
        {label}{required ? ' *' : ''}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? ''}
        placeholderTextColor={colors.inkTertiary}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={{
          backgroundColor: colors.inputBg,
          borderWidth: 0.5,
          borderColor: colors.borderDefault,
          borderRadius: RADIUS.md,
          paddingHorizontal: 14,
          paddingVertical: 11,
          fontSize: 14,
          fontFamily: 'Manrope_400Regular',
          color: colors.inkPrimary,
        }}
      />
    </View>
  );
}

export default function CreateInvoiceScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { colors } = useTheme();

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

  // Style helpers
  const sectionTitleStyle = {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: 'Manrope_600SemiBold' as const,
    fontWeight: '600' as const,
    color: colors.inkPrimary,
    marginBottom: 14,
  };

  const compactInputStyle = {
    backgroundColor: colors.inputBg,
    borderWidth: 0.5,
    borderColor: colors.borderDefault,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: 'Manrope_400Regular' as const,
    color: colors.inkPrimary,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.surfaceApp }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Client */}
        <Card padding="default" style={{ margin: 16 }}>
          <Text style={sectionTitleStyle}>Client Details</Text>
          <InputField label="Client Name" value={clientName} onChangeText={setClientName} placeholder="Acme Corp" required />
          <InputField label="Client Email" value={clientEmail} onChangeText={setClientEmail} placeholder="client@example.com" keyboardType="email-address" />
        </Card>

        {/* Dates */}
        <Card padding="default" style={{ marginHorizontal: 16 }}>
          <Text style={sectionTitleStyle}>Dates</Text>
          <InputField label="Issue Date" value={issueDate} onChangeText={setIssueDate} placeholder="YYYY-MM-DD" required />
          <InputField label="Due Date" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" required />
        </Card>

        {/* Line items */}
        <Card padding="default" style={{ margin: 16 }}>
          <Text style={sectionTitleStyle}>Line Items</Text>
          {lineItems.map((item, idx) => (
            <View
              key={idx}
              style={{
                backgroundColor: colors.surfaceCardElevated,
                borderWidth: 0.5,
                borderColor: colors.borderSubtle,
                borderRadius: RADIUS.md,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <Text style={{
                  fontSize: 13,
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                  color: colors.inkPrimary,
                }}>
                  Item {idx + 1}
                </Text>
                {lineItems.length > 1 && (
                  <TouchableOpacity onPress={() => removeLineItem(idx)} activeOpacity={0.7}>
                    <Text style={{
                      color: colors.accentNegative,
                      fontSize: 13,
                      fontFamily: 'Manrope_600SemiBold',
                      fontWeight: '600',
                    }}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                value={item.description}
                onChangeText={(v) => updateLineItem(idx, 'description', v)}
                placeholder="Description"
                placeholderTextColor={colors.inkTertiary}
                style={[compactInputStyle, { marginBottom: 8 }]}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 12,
                    fontFamily: 'Manrope_400Regular',
                    color: colors.inkSecondary,
                    marginBottom: 4,
                  }}>
                    Qty
                  </Text>
                  <TextInput
                    value={item.quantity}
                    onChangeText={(v) => updateLineItem(idx, 'quantity', v)}
                    keyboardType="decimal-pad"
                    style={compactInputStyle}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={{
                    fontSize: 12,
                    fontFamily: 'Manrope_400Regular',
                    color: colors.inkSecondary,
                    marginBottom: 4,
                  }}>
                    Unit Price
                  </Text>
                  <TextInput
                    value={item.unit_price}
                    onChangeText={(v) => updateLineItem(idx, 'unit_price', v)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.inkTertiary}
                    style={compactInputStyle}
                  />
                </View>
              </View>
              {parseFloat(item.quantity) > 0 && parseFloat(item.unit_price) > 0 && (
                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                  color: colors.brandPrimary,
                  marginTop: 6,
                  textAlign: 'right',
                  fontVariant: ['tabular-nums'],
                }}>
                  {(parseFloat(item.quantity) * parseFloat(item.unit_price)).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
                </Text>
              )}
            </View>
          ))}

          <TouchableOpacity
            onPress={addLineItem}
            activeOpacity={0.7}
            style={{
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.borderDefault,
              borderRadius: RADIUS.md,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: colors.inkSecondary,
              fontFamily: 'Manrope_600SemiBold',
              fontWeight: '600',
              fontSize: 14,
            }}>
              + Add Line Item
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Notes */}
        <Card padding="default" style={{ marginHorizontal: 16 }}>
          <Text style={{
            fontSize: 13,
            fontFamily: 'Manrope_600SemiBold',
            fontWeight: '600',
            color: colors.inkPrimary,
            marginBottom: 6,
          }}>
            Notes (optional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Payment terms, thank you note, etc."
            placeholderTextColor={colors.inkTertiary}
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: colors.inputBg,
              borderWidth: 0.5,
              borderColor: colors.borderDefault,
              borderRadius: RADIUS.md,
              paddingHorizontal: 14,
              paddingVertical: 11,
              fontSize: 14,
              fontFamily: 'Manrope_400Regular',
              color: colors.inkPrimary,
              minHeight: 80,
              textAlignVertical: 'top',
            }}
          />
        </Card>

        {/* Total + Submit */}
        <Card padding="default" style={{ margin: 16 }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 16,
          }}>
            <Text style={{
              fontSize: 18,
              lineHeight: 26,
              fontFamily: 'Manrope_600SemiBold',
              fontWeight: '600',
              color: colors.inkPrimary,
            }}>
              Total
            </Text>
            <Text style={{
              fontSize: 22,
              lineHeight: 28,
              fontFamily: 'Manrope_700Bold',
              fontWeight: '700',
              color: colors.brandPrimary,
              fontVariant: ['tabular-nums'],
            }}>
              {total.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}
            </Text>
          </View>
          <Button
            label="Create Invoice"
            onPress={handleCreate}
            variant="primary"
            size="lg"
            fullWidth
            loading={saving}
          />
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}