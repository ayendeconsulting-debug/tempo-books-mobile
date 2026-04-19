import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  card: string;
  cardBorder: string;
  text: string;
  subtext: string;
  placeholder: string;
  border: string;
  divider: string;
  primary: string;
  primaryLight: string;
  primaryText: string;
  danger: string;
  dangerLight: string;
  warning: string;
  warningLight: string;
  tabBar: string;
  tabBarBorder: string;
  header: string;
  inputBg: string;
  inputBorder: string;
  badgeBg: string;
}

export const LIGHT: ThemeColors = {
  background: '#F9FAFB',
  card: '#FFFFFF',
  cardBorder: '#F3F4F6',
  text: '#111827',
  subtext: '#6B7280',
  placeholder: '#9CA3AF',
  border: '#F3F4F6',
  divider: '#E5E7EB',
  primary: '#0F6E56',
  primaryLight: '#EDF7F2',
  primaryText: '#FFFFFF',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  header: '#0F6E56',
  inputBg: '#F9FAFB',
  inputBorder: '#E5E7EB',
  badgeBg: '#F3F4F6',
};

export const DARK: ThemeColors = {
  background: '#0F172A',
  card: '#1E293B',
  cardBorder: '#334155',
  text: '#F1F5F9',
  subtext: '#94A3B8',
  placeholder: '#64748B',
  border: '#1E293B',
  divider: '#334155',
  primary: '#10B981',
  primaryLight: '#064E3B',
  primaryText: '#FFFFFF',
  danger: '#F87171',
  dangerLight: '#450A0A',
  warning: '#FBBF24',
  warningLight: '#451A03',
  tabBar: '#1E293B',
  tabBarBorder: '#334155',
  header: '#0F172A',
  inputBg: '#0F172A',
  inputBorder: '#334155',
  badgeBg: '#334155',
};

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  colors: LIGHT,
  isDark: false,
  setMode: async () => {},
});

const STORAGE_KEY = 'app_theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((val) => {
        if (val === 'light' || val === 'dark' || val === 'system') {
          setModeState(val);
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  async function setMode(m: ThemeMode) {
    setModeState(m);
    await SecureStore.setItemAsync(STORAGE_KEY, m);
  }

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? DARK : LIGHT;

  // Don't render until theme preference is loaded to avoid flash
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
