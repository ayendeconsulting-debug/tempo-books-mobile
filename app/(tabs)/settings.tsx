import { useAuth, useOrganizationList, useUser } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView, Switch,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { ThemeMode, useTheme } from '../../lib/themeContext';
import * as SecureStore from 'expo-secure-store';
import { registerForPushNotifications, clearPushToken, NOTIFICATIONS_ENABLED_KEY } from '../../lib/notifications';

const WEB_APP = 'https://gettempo.ca';

const MODE_LABEL: Record<string, string> = {
  business: 'Business',
  freelancer: 'Freelancer',
  personal: 'Personal',
};
const MODE_COLOR: Record<string, string> = {
  business: '#2563EB',
  freelancer: '#7C3AED',
  personal: '#D97706',
};

const PLAN_COLOR: Record<string, string> = {
  starter: '#6B7280',
  pro: '#2563EB',
  accountant: '#0F6E56',
};

export default function SettingsScreen() {
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const { activeBusiness, setActiveBusiness, setBusinesses } = useBusiness();
  const { colors, mode: themeMode, setMode: setThemeMode, isDark } = useTheme();
  const qc = useQueryClient();

  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  // Clerk org list for business switcher
  const { userMemberships, setActive, isLoaded: orgsLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  // Subscription info
  const { data: subscription } = useQuery({
    queryKey: ['subscription', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken();
      setAuthToken(token);
      const res = await apiClient.get('/billing/subscription');
      return res.data;
    },
  });

  // Push notifications toggle -- reads persisted preference on mount.
  // Default is ON: unset SecureStore value is treated as enabled so existing
  // users (who upgraded from AAB v1 and never saw the toggle) keep receiving pushes.
  const [pushEnabled, setPushEnabled] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(NOTIFICATIONS_ENABLED_KEY)
      .then(v => setPushEnabled(v !== 'false'))
      .catch(() => {});
  }, []);

  async function handleTogglePush(next: boolean) {
    setPushEnabled(next);
    try {
      await SecureStore.setItemAsync(NOTIFICATIONS_ENABLED_KEY, next ? 'true' : 'false');
    } catch (err) {
      console.warn('[Settings] Failed to persist notification preference:', err);
    }
    if (next) {
      registerForPushNotifications().catch(() => {});
    } else {
      clearPushToken().catch(() => {});
    }
  }

  async function handleSwitchBusiness(orgId: string, orgName: string) {
    if (!setActive) return;
    setSwitching(orgId);
    try {
      await setActive({ organization: orgId });
      // Wait briefly for the new session to settle
      await new Promise(r => setTimeout(r, 800));
      const token = await getToken();
      setAuthToken(token);
      const res = await apiClient.get('/businesses/me');
      if (res.data?.id) {
        setActiveBusiness(res.data);
        setBusinesses([res.data]);
        qc.invalidateQueries();
      }
      setSwitcherVisible(false);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to switch business. Please try again.');
    } finally {
      setSwitching(null);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  }

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const plan = subscription?.plan ?? 'starter';
  const status = subscription?.status;
  const trialEnds = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const daysLeft = trialEnds ? Math.ceil((trialEnds.getTime() - Date.now()) / 86400000) : null;

  const orgs = userMemberships?.data ?? [];

  function Section({ title, children }: { title?: string; children: React.ReactNode }) {
    return (
      <View style={{ marginBottom: 16 }}>
        {title && (
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.subtext, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 6 }}>
            {title}
          </Text>
        )}
        <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.cardBorder, marginHorizontal: 16 }}>
          {children}
        </View>
      </View>
    );
  }

  function Row({ label, value, onPress, destructive, rightElement }: {
    label: string; value?: string; onPress?: () => void;
    destructive?: boolean; rightElement?: React.ReactNode;
  }) {
    const content = (
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: colors.divider,
      }}>
        <Text style={{ fontSize: 15, color: destructive ? colors.danger : colors.text, fontWeight: destructive ? '600' : '400' }}>
          {label}
        </Text>
        {rightElement ?? (value ? <Text style={{ fontSize: 14, color: colors.subtext }}>{value}</Text> : null)}
      </View>
    );
    if (onPress) {
      return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>;
    }
    return content;
  }

  const themeModes: { key: ThemeMode; label: string; emoji: string }[] = [
    { key: 'light', label: 'Light', emoji: '☀️' },
    { key: 'system', label: 'System', emoji: '📱' },
    { key: 'dark', label: 'Dark', emoji: '🌙' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}>

        {/* User card */}
        <View style={{ marginHorizontal: 16, marginBottom: 20, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>
              {(user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            {user?.firstName && (
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{user.firstName} {user.lastName ?? ''}</Text>
            )}
            <Text style={{ fontSize: 13, color: colors.subtext }}>{user?.primaryEmailAddress?.emailAddress}</Text>
          </View>
        </View>

        {/* Business section */}
        <Section title="Business">
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{activeBusiness?.name ?? '—'}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {activeBusiness?.mode && (
                <View style={{ backgroundColor: (MODE_COLOR[activeBusiness.mode] ?? '#9CA3AF') + '18', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: MODE_COLOR[activeBusiness.mode] ?? '#9CA3AF' }}>
                    {MODE_LABEL[activeBusiness.mode] ?? activeBusiness.mode}
                  </Text>
                </View>
              )}
              <View style={{ backgroundColor: (PLAN_COLOR[plan] ?? '#9CA3AF') + '18', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: PLAN_COLOR[plan] ?? '#9CA3AF', textTransform: 'capitalize' }}>
                  {plan}
                </Text>
              </View>
            </View>
          </View>

          {status === 'trialing' && daysLeft != null && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: daysLeft <= 7 ? colors.warningLight : undefined }}>
              <Text style={{ fontSize: 13, color: daysLeft <= 7 ? colors.warning : colors.subtext }}>
                {daysLeft > 0 ? `Trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'Trial expired'}
              </Text>
            </View>
          )}

          <Row
            label="Switch Business"
            onPress={() => setSwitcherVisible(true)}
            rightElement={<Text style={{ fontSize: 18, color: colors.subtext }}>›</Text>}
          />
        </Section>

        {/* Theme section */}
        <Section title="Appearance">
          <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={{ fontSize: 15, color: colors.text, marginBottom: 12 }}>Theme</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {themeModes.map(({ key, label, emoji }) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setThemeMode(key)}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', gap: 4,
                    backgroundColor: themeMode === key ? colors.primary : colors.badgeBg,
                    borderWidth: themeMode === key ? 0 : 1,
                    borderColor: colors.divider,
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{emoji}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: themeMode === key ? '#fff' : colors.subtext }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Section>

        {/* Notifications section */}
        <Section title="Notifications">
          <Row
            label="Push Notifications"
            rightElement={
              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePush}
                trackColor={{ false: colors.divider, true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
        </Section>

        {/* App section */}
        <Section title="App">
          <Row
            label="Full Web App"
            onPress={() => Linking.openURL(WEB_APP)}
            rightElement={<Text style={{ fontSize: 14, color: colors.primary }}>gettempo.ca ›</Text>}
          />
          <Row label="Version" value={`v${appVersion}`} />
        </Section>

        {/* Sign out */}
        <View style={{ marginHorizontal: 16 }}>
          <TouchableOpacity
            onPress={handleSignOut}
            style={{ backgroundColor: colors.dangerLight, borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.danger + '40' }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.danger }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Business Switcher Modal */}
      <Modal visible={switcherVisible} animationType="slide" transparent onRequestClose={() => setSwitcherVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '70%' }}>
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.divider }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Switch Business</Text>
              <TouchableOpacity onPress={() => setSwitcherVisible(false)}>
                <Text style={{ fontSize: 15, color: colors.subtext }}>✕</Text>
              </TouchableOpacity>
            </View>

            {!orgsLoaded ? (
              <ActivityIndicator color={colors.primary} style={{ padding: 24 }} />
            ) : orgs.length === 0 ? (
              <Text style={{ padding: 24, color: colors.subtext, textAlign: 'center' }}>No other businesses found</Text>
            ) : (
              orgs.map((membership: any) => {
                const org = membership.organization;
                const isCurrent = org.name === activeBusiness?.name;
                const isSwitching = switching === org.id;
                return (
                  <TouchableOpacity
                    key={org.id}
                    onPress={() => !isCurrent && handleSwitchBusiness(org.id, org.name)}
                    disabled={isCurrent || !!switching}
                    style={{
                      paddingHorizontal: 24, paddingVertical: 16,
                      borderBottomWidth: 1, borderBottomColor: colors.divider,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      backgroundColor: isCurrent ? colors.primaryLight : undefined,
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: isCurrent ? '700' : '500', color: isCurrent ? colors.primary : colors.text }}>
                        {org.name}
                      </Text>
                      {isCurrent && (
                        <Text style={{ fontSize: 12, color: colors.primary, marginTop: 2 }}>Current</Text>
                      )}
                    </View>
                    {isSwitching
                      ? <ActivityIndicator color={colors.primary} size="small" />
                      : isCurrent
                        ? <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>
                        : <Text style={{ fontSize: 18, color: colors.subtext }}>›</Text>
                    }
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
