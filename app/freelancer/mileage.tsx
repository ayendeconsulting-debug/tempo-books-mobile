import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { useTheme } from '../../lib/themeContext';
import { RADIUS } from '../../lib/tokens';
import HeroCard from '../../components/ui/HeroCard';
import Button from '../../components/ui/Button';

const CRA_RATE = 0.70;

function today() { return new Date().toISOString().split('T')[0]; }
function fmt(n: number) { return '$' + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function MileageScreen() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const year = new Date().getFullYear();

  const [modalVisible, setModalVisible] = useState(false);
  const [tripDate, setTripDate] = useState(today());
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: logs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mileage', activeBusiness?.id, year],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken(); setAuthToken(token);
      const res = await apiClient.get(`/freelancer/mileage?year=${year}`);
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  const totalKm = (logs ?? []).reduce((s: number, l: any) => s + (parseFloat(l.distance_km) || 0), 0);
  const estimatedDeduction = totalKm * CRA_RATE;

  function resetForm() {
    setTripDate(today()); setStartLocation(''); setEndLocation('');
    setPurpose(''); setDistanceKm(''); setError('');
  }

  async function handleAdd() {
    if (!startLocation.trim() || !endLocation.trim() || !purpose.trim() || !distanceKm) { setError('All fields are required.'); return; }
    const km = parseFloat(distanceKm);
    if (isNaN(km) || km <= 0) { setError('Enter a valid distance.'); return; }
    setSaving(true); setError('');
    try {
      const token = await getToken(); setAuthToken(token);
      await apiClient.post('/freelancer/mileage', { trip_date: tripDate, start_location: startLocation.trim(), end_location: endLocation.trim(), purpose: purpose.trim(), distance_km: km });
      qc.invalidateQueries({ queryKey: ['mileage', activeBusiness?.id] });
      setModalVisible(false); resetForm();
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Failed to save trip.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete Trip', 'Remove this mileage entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const token = await getToken(); setAuthToken(token);
          await apiClient.delete(`/freelancer/mileage/${id}`);
          qc.invalidateQueries({ queryKey: ['mileage', activeBusiness?.id] });
        } catch { Alert.alert('Error', 'Failed to delete.'); }
      }},
    ]);
  }

  const fields = [
    { label: 'Date', value: tripDate, setter: setTripDate, placeholder: 'YYYY-MM-DD' },
    { label: 'From', value: startLocation, setter: setStartLocation, placeholder: 'Start location' },
    { label: 'To', value: endLocation, setter: setEndLocation, placeholder: 'End location' },
    { label: 'Purpose', value: purpose, setter: setPurpose, placeholder: 'e.g. Client meeting' },
    { label: 'Distance (km)', value: distanceKm, setter: setDistanceKm, placeholder: '0.0', keyboardType: 'decimal-pad' as const },
  ];

  const inputStyle = {
    backgroundColor: colors.inputBg,
    borderWidth: 0.5,
    borderColor: colors.borderDefault,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Manrope_400Regular' as const,
    color: colors.inkPrimary,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceApp }}>
      {/* Hero - YTD km headline + Log Trip button below */}
      <View style={{ padding: 16 }}>
        <HeroCard
          label={`YTD ${year}`}
          value={`${totalKm.toFixed(1)} km`}
        />
        <Text style={{
          fontSize: 13,
          fontFamily: 'Manrope_400Regular',
          color: colors.inkSecondary,
          marginTop: 8,
          marginBottom: 12,
          fontVariant: ['tabular-nums'],
        }}>
          Est. deduction: {fmt(estimatedDeduction)}
        </Text>
        <Button
          label="+ Log Trip"
          onPress={() => { resetForm(); setModalVisible(true); }}
          variant="primary"
          size="md"
        />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={logs ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => (
            <View style={{
              backgroundColor: colors.surfaceCard,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.borderSubtle,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{
                  fontSize: 14,
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                  color: colors.inkPrimary,
                }}>
                  {item.purpose}
                </Text>
                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Manrope_400Regular',
                  color: colors.inkSecondary,
                  marginTop: 2,
                }}>
                  {item.start_location} → {item.end_location}
                </Text>
                <Text style={{
                  fontSize: 11,
                  fontFamily: 'Manrope_400Regular',
                  color: colors.inkTertiary,
                  marginTop: 2,
                }}>
                  {item.trip_date ? new Date(item.trip_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{
                  fontSize: 14,
                  fontFamily: 'Manrope_700Bold',
                  fontWeight: '700',
                  color: colors.inkPrimary,
                  fontVariant: ['tabular-nums'],
                }}>
                  {parseFloat(item.distance_km).toFixed(1)} km
                </Text>
                <Text style={{
                  fontSize: 11,
                  fontFamily: 'Manrope_400Regular',
                  color: colors.brandPrimary,
                  fontVariant: ['tabular-nums'],
                }}>
                  {fmt(parseFloat(item.distance_km) * CRA_RATE)}
                </Text>
                <TouchableOpacity onPress={() => handleDelete(item.id)} activeOpacity={0.7}>
                  <Text style={{
                    fontSize: 12,
                    fontFamily: 'Manrope_600SemiBold',
                    fontWeight: '600',
                    color: colors.accentNegative,
                    marginTop: 4,
                  }}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ padding: 48, alignItems: 'center' }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🚗</Text>
              <Text style={{
                color: colors.inkPrimary,
                fontSize: 15,
                fontFamily: 'Manrope_600SemiBold',
                fontWeight: '600',
              }}>
                No trips logged
              </Text>
              <Text style={{
                color: colors.inkSecondary,
                fontSize: 13,
                fontFamily: 'Manrope_400Regular',
                marginTop: 4,
              }}>
                Tap + Log Trip to start tracking
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', flex: 1, justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: colors.surfaceCardElevated,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 40,
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
                fontSize: 18,
                lineHeight: 26,
                fontFamily: 'Manrope_600SemiBold',
                fontWeight: '600',
                color: colors.inkPrimary,
                marginBottom: 20,
              }}>
                Log Trip
              </Text>
              {fields.map(({ label, value, setter, placeholder, keyboardType }) => (
                <View key={label} style={{ marginBottom: 12 }}>
                  <Text style={{
                    fontSize: 12,
                    fontFamily: 'Manrope_600SemiBold',
                    fontWeight: '600',
                    color: colors.inkSecondary,
                    marginBottom: 4,
                  }}>
                    {label}
                  </Text>
                  <TextInput
                    value={value}
                    onChangeText={setter}
                    placeholder={placeholder}
                    placeholderTextColor={colors.inkTertiary}
                    keyboardType={keyboardType ?? 'default'}
                    style={inputStyle}
                  />
                </View>
              ))}
              {distanceKm && parseFloat(distanceKm) > 0 && (
                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                  color: colors.brandPrimary,
                  marginBottom: 12,
                  fontVariant: ['tabular-nums'],
                }}>
                  Estimated deduction: {fmt(parseFloat(distanceKm) * CRA_RATE)}
                </Text>
              )}
              {error ? (
                <Text style={{
                  color: colors.accentNegative,
                  fontSize: 13,
                  fontFamily: 'Manrope_400Regular',
                  marginBottom: 8,
                }}>
                  {error}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Cancel"
                    onPress={() => setModalVisible(false)}
                    variant="secondary"
                    size="md"
                    fullWidth
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Button
                    label="Save Trip"
                    onPress={handleAdd}
                    variant="primary"
                    size="md"
                    fullWidth
                    loading={saving}
                  />
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}