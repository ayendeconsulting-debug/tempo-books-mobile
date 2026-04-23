import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform, Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import { apiClient } from './api';

// Configure how notifications are presented when the app is in the foreground.
// Uses the modern expo-notifications handler shape: banner + list + sound + badge.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * SecureStore key used by the Settings toggle to gate push registration.
 * Defined here so notifications.ts and settings.tsx share a single literal.
 * Unset = notifications ON (default); literal string 'false' = OFF.
 */
export const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';

/**
 * Request notification permission, get the Expo push token,
 * and register it with the backend via PATCH /businesses/me/push-token.
 *
 * Safe to call multiple times -- the service layer no-ops if the token
 * hasn't changed, and this function swallows all errors so it never
 * blocks the auth flow.
 *
 * Honors the user's Settings toggle: if NOTIFICATIONS_ENABLED_KEY is
 * explicitly 'false', skips registration silently. Unset defaults to ON
 * so existing users (who never saw the toggle) keep receiving pushes.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    // Honor explicit user preference before anything else
    const enabled = await SecureStore.getItemAsync(NOTIFICATIONS_ENABLED_KEY);
    if (enabled === 'false') {
      console.log('[Push] Skipped: user disabled notifications');
      return;
    }

    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      console.log('[Push] Skipped: not a physical device');
      return;
    }

    // Android requires an explicit notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Tempo Books',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0F6E56',
        showBadge: true,
      });
    }

    // Check existing permission status first to avoid unnecessary prompts
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission denied by user');
      return;
    }

    // Get the Expo push token -- requires the EAS project ID
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '612abef5-6c62-4a5e-885d-59a555f07977',
    });

    const token = tokenData.data;
    console.log('[Push] Token:', token);

    // Register with backend -- fire and forget, errors are non-fatal
    await apiClient.patch('/businesses/me/push-token', { token });
    console.log('[Push] Token registered with backend');
  } catch (err: any) {
    // Never crash the app over a push token failure
    console.warn('[Push] Registration failed (non-fatal):', err?.message ?? err);
  }
}

/**
 * Clear the push token from the backend on sign-out.
 * Prevents notifications being sent to a device that is no longer
 * signed in to this business.
 */
export async function clearPushToken(): Promise<void> {
  try {
    await apiClient.patch('/businesses/me/push-token', { token: null });
    console.log('[Push] Token cleared');
  } catch (err: any) {
    console.warn('[Push] Clear failed (non-fatal):', err?.message ?? err);
  }
}

/**
 * Wire up notification tap handling with deep-link routing.
 *
 * Call from app/_layout.tsx after auth; returns a cleanup function that
 * should be invoked on unmount / auth state change. Uses the imperative
 * router export from expo-router so it works outside React components.
 *
 * Payload shape (set by backend triggers in Phase 20.1.c-f):
 *   { type: 'invoice_overdue', invoiceId }
 *   { type: 'transaction_sync', count }
 *   { type: 'trial_ending', daysLeft }
 *   { type: 'payment_failed' }
 *
 * Billing taps (trial_ending, payment_failed) route to Settings immediately
 * for visual feedback, then open the Stripe Customer Portal in the system
 * browser via a backend-minted session URL.
 */
export function setupNotificationTapHandler(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    const type = data.type as string | undefined;

    switch (type) {
      case 'invoice_overdue': {
        const invoiceId = data.invoiceId;
        if (typeof invoiceId === 'string' || typeof invoiceId === 'number') {
          router.push({
            pathname: '/invoice/[id]',
            params: { id: String(invoiceId) },
          });
        }
        break;
      }
      case 'transaction_sync':
        router.push('/transactions');
        break;
      case 'trial_ending':
      case 'payment_failed': {
        // Instant visual feedback: surface Settings while we fetch the portal URL.
        router.push('/settings');

        // Fire-and-forget: mint a Stripe Customer Portal session on the backend,
        // then hand off to the OS browser. On failure, surface an Alert so the
        // user knows to retry (they are already on Settings).
        (async () => {
          try {
            const res = await apiClient.post('/billing/create-portal-session', {
              return_url: 'https://gettempo.ca',
            });
            const url = res?.data?.url;
            if (typeof url === 'string' && url.length > 0) {
              await Linking.openURL(url);
            } else {
              Alert.alert(
                'Could not open billing portal',
                'Please try again from Settings.',
              );
            }
          } catch (err: any) {
            console.warn('[Push] Portal session fetch failed:', err?.message ?? err);
            Alert.alert(
              'Could not open billing portal',
              'Please try again from Settings.',
            );
          }
        })();
        break;
      }
      default:
        // Unknown payload type -- no-op (app still opens to last screen)
        break;
    }
  });

  return () => sub.remove();
}