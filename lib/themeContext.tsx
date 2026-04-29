import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { LIGHT_TOKENS, DARK_TOKENS } from './tokens';
import type { ThemeColors } from './tokens';

// Re-export for back-compat with any consumer importing these from themeContext.
export type { ThemeColors } from './tokens';
export { LIGHT_TOKENS as LIGHT, DARK_TOKENS as DARK } from './tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  colors: LIGHT_TOKENS,
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
  const colors = isDark ? DARK_TOKENS : LIGHT_TOKENS;

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