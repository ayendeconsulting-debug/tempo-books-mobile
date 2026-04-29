import { useAuth, useOrganizationList, useUser } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { useQueryClient } from '@tanstack/react-query';
import { useSubscription } from '../../lib/useSubscription';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, setAuthToken } from '../../lib/api';
import { useBusiness } from '../../lib/businessContext';
import { ThemeMode, useTheme } from '../../lib/themeContext';
import * as SecureStore from 'expo-secure-store';
import { registerForPushNotifications, clearPushToken, NOTIFICATIONS_ENABLED_KEY } from '../../lib/notifications';
import { RADIUS } from '../../lib/tokens';
import Pill from '../../components/ui/Pill';

const WEB_APP = 'https://gettempo.ca';

const MODE_LABEL: Record<string, string> = {
  business: 'Business',
  freelancer: 'Freelancer',
  personal: 'Personal',
};

type PillVariant = 'positive' | 'negative' | 'warning' | 'info' | 'neutral' | 'brand';

// Mode mapping (Path A): business=info, freelancer=positive, personal=brand
const MODE_VARIANT: Record<string, PillVariant> = {
  business: 'info',
  freelancer: 'positive',
  personal: 'brand',
};

// Plan mapping: starter=neutral, pro=info, accountant=brand
const PLAN_VARIANT: Record<string, PillVariant> = {
  starter: 'neutral',
  pro: 'info',
  accountant: 'brand',
};

export default function SettingsScreen() {
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const { activeBusiness, setActiveBusiness, setBusinesses } = useBusiness();
  const { colors, mode: themeMode, setMode: setThemeMode } = useTheme();
  const qc = useQueryClient();

  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const { userMemberships, setActive, isLoaded: orgsLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const { data: subscription } = useSubscription();

  // Push notifications toggle - reads persisted preference on mount.
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

  async function handleSwitchBusiness(orgId: string, _orgName: string) {
    if (!setActive) return;
    setSwitching(orgId);
    try {
      await setActive({ organization: orgId });
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
          <Text style={{
            fontSize: 11,
            fontFamily: 'Manrope_600SemiBold',
            fontWeight: '600',
            color: colors.inkSecondary,
            textTransform: 'uppercase',
            letterSpacing: 1,
            paddingHorizontal: 16,
            marginBottom: 6,
          }}>
            {title}
          </Text>
        )}
        <View style={{
          backgroundColor: colors.surfaceCard,
          borderRadius: RADIUS.lg,
          overflow: 'hidden',
          borderWidth: 0.5,
          borderColor: colors.borderSubtle,
          marginHorizontal: 16,
        }}>
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
      }}>
        <Text style={{
          fontSize: 15,
          fontFamily: destructive ? 'Manrope_600SemiBold' : 'Manrope_400Regular',
          fontWeight: destructive ? '600' : '400',
          color: destructive ? colors.accentNegative : colors.inkPrimary,
        }}>
          {label}
        </Text>
        {rightElement ?? (value ? (
          <Text style={{
            fontSize: 14,
            fontFamily: 'Manrope_400Regular',
            color: colors.inkSecondary,
          }}>
            {value}
          </Text>
        ) : null)}
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceApp }}>
      <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}>

        {/* User card */}
        <View style={{
          marginHorizontal: 16,
          marginBottom: 20,
          backgroundColor: colors.surfaceCard,
          borderRadius: RADIUS.lg,
          padding: 16,
          borderWidth: 0.5,
          borderColor: colors.borderSubtle,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}>
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.brandPrimary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{
              fontSize: 18,
              fontFamily: 'Manrope_700Bold',
              fontWeight: '700',
              color: '#ffffff',
            }}>
              {(user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            {user?.firstName && (
              <Text style={{
                fontSize: 15,
                fontFamily: 'Manrope_700Bold',
                fontWeight: '700',
                color: colors.inkPrimary,
              }}>
                {user.firstName} {user.lastName ?? ''}
              </Text>
            )}
            <Text style={{
              fontSize: 13,
              fontFamily: 'Manrope_400Regular',
              color: colors.inkSecondary,
            }}>
              {user?.primaryEmailAddress?.emailAddress}
            </Text>
          </View>
        </View>

        {/* Business section */}
        <Section title="Business">
          <View style={{
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.borderSubtle,
          }}>
            <Text style={{
              fontSize: 16,
              fontFamily: 'Manrope_700Bold',
              fontWeight: '700',
              color: colors.inkPrimary,
            }}>
              {activeBusiness?.name ?? '—'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {activeBusiness?.mode && (
                <Pill variant={MODE_VARIANT[activeBusiness.mode] ?? 'neutral'} size="sm">
                  {MODE_LABEL[activeBusiness.mode] ?? activeBusiness.mode}
                </Pill>
              )}
              <Pill variant={PLAN_VARIANT[plan] ?? 'neutral'} size="sm">
                {plan.charAt(0).toUpperCase() + plan.slice(1)}
              </Pill>
            </View>
          </View>

          {status === 'trialing' && daysLeft != null && (
            <View style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.borderSubtle,
              backgroundColor: daysLeft <= 7 ? colors.warningLight : 'transparent',
            }}>
              <Text style={{
                fontSize: 13,
                fontFamily: 'Manrope_400Regular',
                color: daysLeft <= 7 ? colors.accentWarning : colors.inkSecondary,
              }}>
                {daysLeft > 0 ? `Trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'Trial expired'}
              </Text>
            </View>
          )}

          <Row
            label="Switch Business"
            onPress={() => setSwitcherVisible(true)}
            rightElement={
              <Text style={{ fontSize: 18, color: colors.inkSecondary }}>›</Text>
            }
          />
        </Section>

        {/* Theme section */}
        <Section title="Appearance">
          <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={{
              fontSize: 15,
              fontFamily: 'Manrope_400Regular',
              color: colors.inkPrimary,
              marginBottom: 12,
            }}>
              Theme
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {themeModes.map(({ key, label, emoji }) => {
                const isActive = themeMode === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setThemeMode(key)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: RADIUS.md,
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: isActive ? colors.brandPrimary : colors.surfaceCardElevated,
                      borderWidth: isActive ? 0 : 0.5,
                      borderColor: colors.borderSubtle,
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>{emoji}</Text>
                    <Text style={{
                      fontSize: 12,
                      fontFamily: 'Manrope_600SemiBold',
                      fontWeight: '600',
                      color: isActive ? '#ffffff' : colors.inkSecondary,
                    }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Row
            label="Push Notifications"
            rightElement={
              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePush}
                trackColor={{ false: colors.borderDefault, true: colors.brandPrimary }}
                thumbColor="#ffffff"
              />
            }
          />
        </Section>

        {/* App */}
        <Section title="App">
          <Row
            label="Full Web App"
            onPress={() => Linking.openURL(WEB_APP)}
            rightElement={
              <Text style={{
                fontSize: 14,
                fontFamily: 'Manrope_400Regular',
                color: colors.brandPrimary,
              }}>
                gettempo.ca ›
              </Text>
            }
          />
          <Row label="Version" value={`v${appVersion}`} />
        </Section>

        {/* Sign out */}
        <View style={{ marginHorizontal: 16 }}>
          <TouchableOpacity
            onPress={handleSignOut}
            activeOpacity={0.7}
            style={{
              borderRadius: RADIUS.lg,
              paddingVertical: 16,
              alignItems: 'center',
              borderWidth: 0.5,
              borderColor: colors.accentNegative,
              backgroundColor: 'transparent',
            }}
          >
            <Text style={{
              fontSize: 15,
              fontFamily: 'Manrope_600SemiBold',
              fontWeight: '600',
              color: colors.accentNegative,
            }}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Business Switcher Modal */}
      <Modal visible={switcherVisible} animationType="slide" transparent onRequestClose={() => setSwitcherVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View style={{
            backgroundColor: colors.surfaceCardElevated,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: 40,
            maxHeight: '70%',
          }}>
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.borderDefault,
              }} />
            </View>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 24,
              paddingVertical: 14,
            }}>
              <Text style={{
                fontSize: 17,
                fontFamily: 'Manrope_700Bold',
                fontWeight: '700',
                color: colors.inkPrimary,
              }}>
                Switch Business
              </Text>
              <TouchableOpacity onPress={() => setSwitcherVisible(false)} activeOpacity={0.7}>
                <Text style={{ fontSize: 15, color: colors.inkSecondary }}>✕</Text>
              </TouchableOpacity>
            </View>

            {!orgsLoaded ? (
              <ActivityIndicator color={colors.brandPrimary} style={{ padding: 24 }} />
            ) : orgs.length === 0 ? (
              <Text style={{
                padding: 24,
                color: colors.inkSecondary,
                fontFamily: 'Manrope_400Regular',
                textAlign: 'center',
              }}>
                No other businesses found
              </Text>
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
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: 24,
                      paddingVertical: 16,
                      borderBottomWidth: 0.5,
                      borderBottomColor: colors.borderSubtle,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isCurrent ? colors.primaryLight : 'transparent',
                    }}
                  >
                    <View>
                      <Text style={{
                        fontSize: 15,
                        fontFamily: isCurrent ? 'Manrope_700Bold' : 'Manrope_600SemiBold',
                        fontWeight: isCurrent ? '700' : '600',
                        color: isCurrent ? colors.brandPrimary : colors.inkPrimary,
                      }}>
                        {org.name}
                      </Text>
                      {isCurrent && (
                        <Text style={{
                          fontSize: 12,
                          fontFamily: 'Manrope_400Regular',
                          color: colors.brandPrimary,
                          marginTop: 2,
                        }}>
                          Current
                        </Text>
                      )}
                    </View>
                    {isSwitching
                      ? <ActivityIndicator color={colors.brandPrimary} size="small" />
                      : isCurrent
                        ? <Text style={{
                            color: colors.brandPrimary,
                            fontFamily: 'Manrope_700Bold',
                            fontWeight: '700',
                          }}>✓</Text>
                        : <Text style={{ fontSize: 18, color: colors.inkSecondary }}>›</Text>
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