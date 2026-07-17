import { Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  value: string | number;
  currency?: string;
  size?: 'md' | 'lg';
  testID?: string;
};

export function PriceLabel({ value, currency, size = 'md', testID }: Props) {
  const { theme } = useTheme();
  const style = size === 'lg' ? theme.typography.priceLg : theme.typography.price;
  const formatted = typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 8 }) : value;

  return (
    <Text
      testID={testID}
      style={[
        style,
        styles.base,
        { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: style.fontFamily ?? theme.fonts.mono },
      ]}
    >
      {formatted}
      {currency ? (
        <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}> {currency}</Text>
      ) : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { fontVariant: ['tabular-nums'] },
});
