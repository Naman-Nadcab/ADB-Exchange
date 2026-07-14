import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  label: string | number;
  tone?: 'default' | 'buy' | 'sell' | 'warning' | 'muted';
  testID?: string;
};

export function Badge({ label, tone = 'default', testID }: Props) {
  const { theme } = useTheme();
  const palette = getTone(tone, theme.colors);

  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[theme.typography.labelSm, { color: palette.fg, fontFamily: theme.fonts.sansSemiBold }]}>
        {label}
      </Text>
    </View>
  );
}

function getTone(tone: Props['tone'], c: ReturnType<typeof useTheme>['theme']['colors']) {
  switch (tone) {
    case 'buy':
      return { bg: `hsl(${c.tradeBuy} / 0.15)`, fg: `hsl(${c.tradeBuy})`, border: `hsl(${c.tradeBuy} / 0.25)` };
    case 'sell':
      return { bg: `hsl(${c.tradeSell} / 0.15)`, fg: `hsl(${c.tradeSell})`, border: `hsl(${c.tradeSell} / 0.25)` };
    case 'warning':
      return { bg: `hsl(${c.statusWarning} / 0.15)`, fg: `hsl(${c.statusWarning})`, border: `hsl(${c.statusWarning} / 0.25)` };
    case 'muted':
      return { bg: `hsl(${c.surfaceMuted})`, fg: `hsl(${c.foregroundSecondary})`, border: `hsl(${c.borderDefault})` };
    default:
      return { bg: `hsl(${c.brandPrimary} / 0.12)`, fg: `hsl(${c.brandPrimary})`, border: `hsl(${c.brandPrimary} / 0.2)` };
  }
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
