import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  label: string;
  value: string;
  sub?: string;
  direction?: 'in' | 'out';
  onPress?: () => void;
};

export function TxHistoryRow({ label, value, sub, direction, onPress }: Props) {
  const { theme } = useTheme();
  const color =
    direction === 'in' ? theme.colors.tradeBuy : direction === 'out' ? theme.colors.tradeSell : theme.colors.foregroundPrimary;

  const content = (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>{label}</Text>
        {sub ? (
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>{sub}</Text>
        ) : null}
      </View>
      <Text style={{ color: `hsl(${color})`, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, minHeight: 44 },
});
