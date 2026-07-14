import { Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  changePct: number;
  testID?: string;
};

export function ChangeLabel({ changePct, testID }: Props) {
  const { theme } = useTheme();
  const up = changePct >= 0;
  const color = up ? theme.colors.tradeBuy : theme.colors.tradeSell;
  const prefix = up ? '+' : '';

  return (
    <Text
      testID={testID}
      style={[theme.typography.price, styles.base, { color: `hsl(${color})` }]}
    >
      {prefix}
      {changePct.toFixed(2)}%
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { fontVariant: ['tabular-nums'] },
});
