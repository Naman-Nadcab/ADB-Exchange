import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import type { EscrowTimelineStep } from '@core/domain/p2p/order';

type Props = { steps: EscrowTimelineStep[] };

export function OrderTimeline({ steps }: Props) {
  const { theme } = useTheme();
  return (
    <View style={styles.wrap}>
      {steps.map((s) => (
        <View key={s.key} style={styles.step}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: s.active
                  ? `hsl(${theme.colors.brandPrimary})`
                  : s.done
                    ? `hsl(${theme.colors.tradeBuy})`
                    : `hsl(${theme.colors.foregroundSecondary})`,
              },
            ]}
          />
          <Text
            style={{
              color: `hsl(${s.active ? theme.colors.foregroundPrimary : theme.colors.foregroundSecondary})`,
              fontWeight: s.active ? '700' : '400',
            }}
          >
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 12, gap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
