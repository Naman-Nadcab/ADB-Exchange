import { useMemo } from 'react';
import { useTheme } from './useTheme';

export function useThemeStyles<T>(factory: (theme: ReturnType<typeof useTheme>['theme']) => T): T {
  const { theme } = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}

export { hsl, hslAlpha } from './tokens';
