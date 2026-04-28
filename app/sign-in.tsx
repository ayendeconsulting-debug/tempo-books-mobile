import { useSignIn, useSSO } from '@clerk/clerk-expo';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { startSSOFlow } = useSSO();
  const { signIn, setActive: setActiveSession, isLoaded } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState('');

  const redirectUrl = makeRedirectUri({
    scheme: 'tempbooks',
    path: 'sign-in',
  });

  async function handleEmailSignIn() {
    if (!isLoaded || !signIn) return;
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoadingEmail(true);
    try {
      let attempt = await signIn.create({
        strategy: 'password',
        identifier: trimmedEmail,
        password,
      });

      // Fallback: if create() returns 'needs_first_factor' (some Clerk configs
      // require an explicit second call), complete via attemptFirstFactor.
      if (attempt.status === 'needs_first_factor') {
        attempt = await signIn.attemptFirstFactor({
          strategy: 'password',
          password,
        });
      }

      if (attempt.status === 'complete' && attempt.createdSessionId && setActiveSession) {
        await setActiveSession({ session: attempt.createdSessionId });
      } else {
        setError(`Sign in could not be completed (status: ${attempt.status}). Please try again.`);
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        err?.errors?.[0]?.code ??
        err?.message ??
        'Something went wrong.';
      setError(msg);
    } finally {
      setLoadingEmail(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoadingGoogle(true);
    setError('');
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
      setLoadingGoogle(false);
    }
  }

  const anyLoading = loadingEmail || loadingGoogle;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-8 items-center">
          <Image
            source={require('../assets/tempo-logo-bar.png')}
            style={{ width: 72, height: 72, borderRadius: 16 }}
            resizeMode="contain"
          />
          <Text className="text-2xl font-bold text-gray-900 mt-4">Tempo Books</Text>
          <Text className="text-gray-500 mt-1">Sign in to your account</Text>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!anyLoading}
            style={{
              borderWidth: 1.5,
              borderColor: '#E5E7EB',
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
              fontSize: 16,
              color: '#111827',
              backgroundColor: '#FFFFFF',
            }}
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            editable={!anyLoading}
            style={{
              borderWidth: 1.5,
              borderColor: '#E5E7EB',
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
              fontSize: 16,
              color: '#111827',
              backgroundColor: '#FFFFFF',
            }}
          />
        </View>

        <TouchableOpacity
          onPress={handleEmailSignIn}
          disabled={anyLoading}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0F6E56',
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 24,
            marginBottom: 20,
            opacity: anyLoading ? 0.7 : 1,
          }}
        >
          {loadingEmail ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Sign in</Text>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
          <Text style={{ marginHorizontal: 12, color: '#9CA3AF', fontSize: 12 }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
        </View>

        <TouchableOpacity
          onPress={handleGoogleSignIn}
          disabled={anyLoading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFFFFF',
            borderWidth: 1.5,
            borderColor: '#E5E7EB',
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 24,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
            opacity: anyLoading ? 0.7 : 1,
          }}
        >
          {loadingGoogle ? (
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
          <Text className="text-red-600 text-sm text-center mt-4">{error}</Text>
        ) : null}

        <Text className="text-center text-gray-400 text-xs mt-6">
          Manage your account at gettempo.ca
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}