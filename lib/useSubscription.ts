import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { apiClient, setAuthToken } from './api';
import { useBusiness } from './businessContext';

export type SubscriptionPlan = 'starter' | 'pro' | 'accountant';
export type SubscriptionStatus =
  | 'none' | 'trialing' | 'active' | 'past_due'
  | 'cancelled' | 'trial_expired_readonly' | 'archived';
export type BillingCycle = 'monthly' | 'annual';

export interface Subscription {
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  billing_cycle?: BillingCycle;
  trial_ends_at: string | null;
  current_period_end: string | null;
  days_remaining: number | null;
  mbg_ends_at: string | null;
  readonly_started_at: string | null;
  stripe_customer_id: string | null;
}

/**
 * Fetches the current subscription for the active business.
 * Cached per businessId via react-query — multiple consumers share the cache.
 */
export function useSubscription() {
  const { activeBusiness } = useBusiness();
  const { getToken } = useAuth();

  return useQuery<Subscription>({
    queryKey: ['subscription', activeBusiness?.id],
    enabled: !!activeBusiness?.id,
    queryFn: async () => {
      const token = await getToken();
      setAuthToken(token);
      const res = await apiClient.get('/billing/subscription');
      return res.data as Subscription;
    },
  });
}

/**
 * Returns whether the active business has access to AI features
 * (receipt extract, anomaly detection, etc.). Pro and Accountant only.
 * Starter (Personal-labelled), null, and undefined all return false.
 */
export function useAiFeatureAccess(): {
  hasAccess: boolean;
  plan: SubscriptionPlan | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useSubscription();
  const plan = data?.plan ?? null;
  const hasAccess = plan === 'pro' || plan === 'accountant';
  return { hasAccess, plan, isLoading };
}