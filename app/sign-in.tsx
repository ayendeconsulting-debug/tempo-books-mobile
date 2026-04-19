import { useSSO } from '@clerk/clerk-expo';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { startSSOFlow } = useSSO();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectUrl = makeRedirectUri({
    scheme: 'tempbooks',
    path: 'sign-in',
  });

  async function handleGoogleSignIn() {
    setLoading(true);
    setError('');
    console.log('Redirect URL:', redirectUrl);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      } else {
        setError('Sign in could not be completed. Please try again.');
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.message ?? 'Something went wrong.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-6">
        <View className="mb-10 items-center">
          <Image
            source={require('../assets/tempo-logo-bar.png')}
            style={{ width: 72, height: 72, borderRadius: 16 }}
            resizeMode="contain"
          />
          <Text className="text-2xl font-bold text-gray-900 mt-4">Tempo Books</Text>
          <Text className="text-gray-500 mt-1">Sign in to your account</Text>
        </View>

        <TouchableOpacity
          onPress={handleGoogleSignIn}
          disabled={loading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            borderWidth: 1.5,
            borderColor: '#E5E7EB',
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 24,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#0F6E56" />
          ) : (
            <>
              <View style={{ marginRight: 12 }}>
                <Text style={{ fontSize: 18 }}>G</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {error ? (
          <Text className="text-red-600 text-sm text-center mt-2">{error}</Text>
        ) : null}

        <Text className="text-center text-gray-400 text-xs mt-4">
          Redirect: {redirectUrl}
        </Text>

        <Text className="text-center text-gray-400 text-xs mt-4">
          Manage your account at gettempo.ca
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}