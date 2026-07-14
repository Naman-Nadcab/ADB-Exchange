import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme, hapticSelection } from '@shared/theme';
import type { OrderSide } from '@exchange/mobile-types';

type Props = {
  side: OrderSide;
  onChange: (side: OrderSide) => void;
};

export function TradeSideToggle({ side, onChange }: Props) {
  const { theme } = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: `hsl(${theme.colors.surfaceMuted})`, borderRadius: theme.radius.lg, padding: 4, marginBottom: theme.spacing[3] }]}>
      {(['buy', 'sell'] as const).map((s) => {
        const active = side === s;
        const bg = s === 'buy' ? theme.colors.tradeBuy : theme.colors.tradeSell;
        return (
          <Pressable
            key={s}
            onPress={() => {
              void hapticSelection();
              onChange(s);
            }}
            style={[
              styles.btn,
              {
                borderRadius: theme.radius.md,
                backgroundColor: active ? `hsl(${bg})` : 'transparent',
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                theme.typography.bodyMd,
                {
                  fontFamily: theme.fonts.sansSemiBold,
                  color: active ? '#ffffff' : `hsl(${theme.colors.foregroundSecondary})`,
                  textTransform: 'capitalize',
                },
              ]}
            >
              {s}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 10, minHeight: 44 },
});
