import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, hapticLight } from '@shared/theme';

type Props = {
  label: string;
  value: string;
  sub?: string;
  direction?: 'in' | 'out';
  onPress?: () => void;
};

export function TxHistoryRow({ label, value, sub, direction, onPress }: Props) {
  const { theme } = useTheme();
  const density = theme.listDensity.default;
  const color =
    direction === 'in' ? theme.colors.tradeBuy : direction === 'out' ? theme.colors.tradeSell : theme.colors.foregroundPrimary;

  const content = (
    <View
      style={[
        styles.row,
        {
          paddingVertical: theme.spacing[2.5],
          minHeight: density.rowHeight,
          gap: density.gap,
        },
      ]}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text
          style={[
            theme.typography.bodyMd,
            { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
          ]}
        >
          {label}
        </Text>
        {sub ? (
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
            ]}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          theme.typography.price,
          {
            color: `hsl(${color})`,
            fontFamily: theme.fonts.monoSemiBold,
            fontVariant: ['tabular-nums'],
            textAlign: 'right',
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          void hapticLight();
          onPress();
        }}
        accessibilityRole="button"
        style={({ pressed }) => ({ opacity: pressed ? theme.opacity.pressed : 1 })}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
