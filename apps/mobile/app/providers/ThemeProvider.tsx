import { useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type ThemeContextValue } from '@shared/theme/context';
import { createTheme, type ColorScheme } from '@shared/theme/tokens';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';

type Props = { children: ReactNode };

function readInitialScheme(): ColorScheme {
  const saved = mmkvStorage.getString(CACHE_KEYS.theme);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'dark';
}

export function ThemeProvider({ children }: Props) {
  const [colorScheme, setSchemeState] = useState<ColorScheme>(readInitialScheme);

  const setColorScheme = (scheme: ColorScheme) => {
    mmkvStorage.set(CACHE_KEYS.theme, scheme);
    setSchemeState(scheme);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: createTheme(colorScheme),
      colorScheme,
      setColorScheme,
    }),
    [colorScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
