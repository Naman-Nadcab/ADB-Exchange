import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

export type StatusChipTone = 'live' | 'sync' | 'warn' | 'off' | 'neutral';

type Props = {
  label: string;
  tone?: StatusChipTone;
  pulse?: boolean;
  testID?: string;
};

export function StatusChip({ label, tone = 'neutral', pulse, testID }: Props) {
  const { theme } = useTheme();
  const palette = getTone(tone, theme.colors);

  return (
    <View
      testID={testID}
      style={[
        styles.chip,
        {
          borderColor: palette.border,
          backgroundColor: palette.bg,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: palette.dot }, pulse && styles.pulse]} />
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

function getTone(tone: StatusChipTone, c: ReturnType<typeof useTheme>['theme']['colors']) {
  switch (tone) {
    case 'live':
      return { border: `hsl(${c.tradeBuy} / 0.35)`, bg: `hsl(${c.tradeBuy} / 0.1)`, fg: `hsl(${c.tradeBuy})`, dot: `hsl(${c.tradeBuy})` };
    case 'sync':
      return { border: `hsl(${c.brandPrimary} / 0.35)`, bg: `hsl(${c.brandPrimary} / 0.08)`, fg: `hsl(${c.brandPrimary})`, dot: `hsl(${c.brandPrimary})` };
    case 'warn':
      return { border: `hsl(${c.statusWarning} / 0.4)`, bg: `hsl(${c.statusWarning} / 0.12)`, fg: `hsl(${c.foregroundPrimary} / 0.88)`, dot: `hsl(${c.statusWarning})` };
    case 'off':
      return { border: `hsl(${c.tradeSell} / 0.35)`, bg: `hsl(${c.tradeSell} / 0.1)`, fg: `hsl(${c.tradeSell})`, dot: `hsl(${c.tradeSell})` };
    default:
      return { border: `hsl(${c.borderDefault} / 0.85)`, bg: `hsl(${c.surfaceMuted} / 0.35)`, fg: `hsl(${c.foregroundSecondary})`, dot: `hsl(${c.foregroundSecondary} / 0.65)` };
  }
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  pulse: { opacity: 0.85 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
});
