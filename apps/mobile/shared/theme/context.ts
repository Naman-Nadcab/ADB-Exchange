import { createContext } from 'react';
import type { ThemeTokens } from './tokens';

export type ThemeContextValue = {
  theme: ThemeTokens;
  colorScheme: 'light' | 'dark';
  setColorScheme: (scheme: 'light' | 'dark') => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);
