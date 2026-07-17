import type { lightColors, darkColors } from './tokens';

type ColorSet = typeof lightColors | typeof darkColors;

export type SemanticStatusTone = 'success' | 'warning' | 'error' | 'info' | 'buy' | 'sell' | 'brand' | 'muted';

export type StatusChipTone = 'live' | 'sync' | 'warn' | 'off' | 'neutral';

export type StatusPalette = {
  bg: string;
  fg: string;
  border: string;
  dot?: string;
};

const alpha = (token: string, value: number) => `hsl(${token} / ${value})`;

export function semanticStatusPalette(c: ColorSet, tone: SemanticStatusTone): StatusPalette {
  switch (tone) {
    case 'success':
      return {
        bg: alpha(c.statusSuccess, 0.15),
        fg: `hsl(${c.statusSuccess})`,
        border: alpha(c.statusSuccess, 0.3),
        dot: `hsl(${c.statusSuccess})`,
      };
    case 'warning':
      return {
        bg: alpha(c.statusWarning, 0.15),
        fg: `hsl(${c.statusWarning})`,
        border: alpha(c.statusWarning, 0.3),
        dot: `hsl(${c.statusWarning})`,
      };
    case 'error':
      return {
        bg: alpha(c.statusError, 0.15),
        fg: `hsl(${c.statusError})`,
        border: alpha(c.statusError, 0.3),
        dot: `hsl(${c.statusError})`,
      };
    case 'info':
      return {
        bg: alpha(c.statusInfo, 0.15),
        fg: `hsl(${c.statusInfo})`,
        border: alpha(c.statusInfo, 0.3),
        dot: `hsl(${c.statusInfo})`,
      };
    case 'buy':
      return {
        bg: alpha(c.tradeBuy, 0.15),
        fg: `hsl(${c.tradeBuy})`,
        border: alpha(c.tradeBuy, 0.25),
        dot: `hsl(${c.tradeBuy})`,
      };
    case 'sell':
      return {
        bg: alpha(c.tradeSell, 0.15),
        fg: `hsl(${c.tradeSell})`,
        border: alpha(c.tradeSell, 0.25),
        dot: `hsl(${c.tradeSell})`,
      };
    case 'muted':
      return {
        bg: `hsl(${c.surfaceMuted})`,
        fg: `hsl(${c.foregroundSecondary})`,
        border: `hsl(${c.borderDefault})`,
        dot: alpha(c.foregroundSecondary, 0.65),
      };
    default:
      return {
        bg: alpha(c.brandPrimary, 0.12),
        fg: `hsl(${c.brandPrimary})`,
        border: alpha(c.brandPrimary, 0.2),
        dot: `hsl(${c.brandPrimary})`,
      };
  }
}

export function statusChipPalette(c: ColorSet, tone: StatusChipTone): StatusPalette {
  switch (tone) {
    case 'live':
      return {
        border: alpha(c.tradeBuy, 0.35),
        bg: alpha(c.tradeBuy, 0.1),
        fg: `hsl(${c.tradeBuy})`,
        dot: `hsl(${c.tradeBuy})`,
      };
    case 'sync':
      return {
        border: alpha(c.brandPrimary, 0.35),
        bg: alpha(c.brandPrimary, 0.08),
        fg: `hsl(${c.brandPrimary})`,
        dot: `hsl(${c.brandPrimary})`,
      };
    case 'warn':
      return {
        border: alpha(c.statusWarning, 0.4),
        bg: alpha(c.statusWarning, 0.12),
        fg: alpha(c.foregroundPrimary, 0.88),
        dot: `hsl(${c.statusWarning})`,
      };
    case 'off':
      return {
        border: alpha(c.tradeSell, 0.35),
        bg: alpha(c.tradeSell, 0.1),
        fg: `hsl(${c.tradeSell})`,
        dot: `hsl(${c.tradeSell})`,
      };
    default:
      return {
        border: alpha(c.borderDefault, 0.85),
        bg: alpha(c.surfaceMuted, 0.35),
        fg: `hsl(${c.foregroundSecondary})`,
        dot: alpha(c.foregroundSecondary, 0.65),
      };
  }
}
