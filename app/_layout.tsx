import '../global.css';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { queryClient } from '../lib/queryClient';
import { setAuthToken, apiClient } from '../lib/api';
import { BusinessProvider, useBusiness } from '../lib/businessContext';
import { ThemeProvider } from '../lib/themeContext';
import { registerForPushNotifications, clearPushToken, setupNotificationTapHandler } from '../lib/notifications';

const CLERK_KEY = 'pk_live_Y2xlcmsuZ2V0dGVtcG8uY2Ek';
const BUSINESS_KEY = 'active_business_json';

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
  async clearToken(key: string) {
    return SecureStore.deleteItemAsync(key);
  },
};

function AuthGate() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { setActiveBusiness, setBusinesses } = useBusiness();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'authed' | 'unauthed'>('loading');

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      // Clear push token before wiping local state so the PATCH still has
      // a valid auth token. clearPushToken is fire-and-forget.
      clearPushToken().catch(() => {});
      SecureStore.deleteItemAsync(BUSINESS_KEY).catch(() => {});
      setState('unauthed');
      return;
    }

    async function load() {
      try {
        const token = await getToken();
        setAuthToken(token);

        const cached = await SecureStore.getItemAsync(BUSINESS_KEY);
        if (cached) {
          const business = JSON.parse(cached);
          setActiveBusiness(business);
          setBusinesses([business]);
          setState('authed');
          // Background refresh -- update cached business + register push token
          apiClient.get('/businesses/me').then((res) => {
            if (res.data?.id) {
              setActiveBusiness(res.data);
              setBusinesses([res.data]);
              SecureStore.setItemAsync(BUSINESS_KEY, JSON.stringify(res.data)).catch(() => {});
            }
          }).catch(() => {});
          // Register push token after auth is confirmed -- fire and forget
          registerForPushNotifications().catch(() => {});
          return;
        }

        const res = await apiClient.get('/businesses/me');
        if (res.data?.id) {
          setActiveBusiness(res.data);
          setBusinesses([res.data]);
          await SecureStore.setItemAsync(BUSINESS_KEY, JSON.stringify(res.data));
        }
        setState('authed');
        // Register push token after fresh load too
        registerForPushNotifications().catch(() => {});
      } catch (err: any) {
        console.log('Load error:', err?.response?.status, err?.message);
        setState('authed');
      }
    }

    load();
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (state === 'unauthed') router.replace('/sign-in');
    if (state === 'authed') router.replace('/(tabs)');
  }, [state]);

  // Phase 20.1.g -- wire notification tap handler once authed.
  // Cleanup runs on sign-out (state -> 'unauthed') and re-wires on re-auth.
  useEffect(() => {
    if (state !== 'authed') return;
    const cleanup = setupNotificationTapHandler();
    return cleanup;
  }, [state]);

  if (state === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0F6E56" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
        <QueryClientProvider client={queryClient}>
          <BusinessProvider>
            <AuthGate />
          </BusinessProvider>
        </QueryClientProvider>
      </ClerkProvider>
    </ThemeProvider>
  );
}