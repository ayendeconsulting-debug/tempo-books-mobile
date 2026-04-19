import { useRouter } from 'expo-router';
import { Image, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { useBusiness } from '../lib/businessContext';

export default function BusinessPickerScreen() {
  const { businesses, setActiveBusiness } = useBusiness();
  const router = useRouter();

  function handleSelect(b: any) {
    setActiveBusiness(b);
    router.replace('/(tabs)');
  }

  const modeLabel: Record<string, string> = {
    business: 'Business',
    freelancer: 'Freelancer',
    personal: 'Personal',
  };

  const modeColor: Record<string, string> = {
    business: '#0F6E56',
    freelancer: '#7C3AED',
    personal: '#2563EB',
  };

  return (
    <View className="flex-1 bg-white">
      <View className="pt-16 pb-6 px-6 items-center">
        <Image
          source={require('../assets/tempo-logo-bar.png')}
          style={{ width: 56, height: 56, borderRadius: 12, marginBottom: 16 }}
          resizeMode="contain"
        />
        <Text className="text-2xl font-bold text-gray-900">Choose a Business</Text>
        <Text className="text-gray-500 mt-1 text-center">Select which account to open</Text>
      </View>

      <ScrollView className="px-4">
        {businesses.map((b) => (
          <TouchableOpacity
            key={b.id}
            onPress={() => handleSelect(b)}
            style={{
              backgroundColor: '#fff',
              borderWidth: 1.5,
              borderColor: '#E5E7EB',
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{b.name}</Text>
              <View style={{
                marginTop: 4,
                backgroundColor: modeColor[b.mode] + '18',
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 2,
                alignSelf: 'flex-start',
              }}>
                <Text style={{ fontSize: 12, color: modeColor[b.mode], fontWeight: '600' }}>
                  {modeLabel[b.mode] ?? b.mode}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 22, color: '#9CA3AF' }}>ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Âº</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
