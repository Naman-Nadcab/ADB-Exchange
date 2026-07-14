import type { ViewStyle } from 'react-native';
import type { ColorScheme } from './tokens';

/** Elevation shadows derived from frontend .terminal-panel-elevated */
export function createShadows(scheme: ColorScheme) {
  const isDark = scheme === 'dark';
  return {
    none: {} satisfies ViewStyle,
    sm: {
      shadowColor: isDark ? '#000' : '#1a1f2e',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.24 : 0.08,
      shadowRadius: 6,
      elevation: 2,
    } satisfies ViewStyle,
    md: {
      shadowColor: isDark ? '#000' : '#1a1f2e',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.28 : 0.12,
      shadowRadius: 22,
      elevation: 6,
    } satisfies ViewStyle,
    focus: {
      shadowColor: isDark ? '#c9a227' : '#e6c200',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 26,
      elevation: 8,
    } satisfies ViewStyle,
  } as const;
}

export type ShadowTokens = ReturnType<typeof createShadows>;
