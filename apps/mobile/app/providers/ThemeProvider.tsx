import { useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeContext, type ThemeContextValue } from '@shared/theme/context';
import { createTheme, type ColorScheme } from '@shared/theme/tokens';

type Props = { children: ReactNode };

export function ThemeProvider({ children }: Props) {
  const system = useColorScheme();
  const [override, setOverride] = useState<ColorScheme | null>(null);
  const colorScheme: ColorScheme = override ?? (system === 'dark' ? 'dark' : 'light');

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: createTheme(colorScheme),
      colorScheme,
      setColorScheme: setOverride,
    }),
    [colorScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
