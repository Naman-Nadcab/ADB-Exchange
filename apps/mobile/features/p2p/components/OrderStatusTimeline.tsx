import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import type { OrderStatusTimelineStep } from '@core/domain/p2p/orderRoom';

type Props = { steps: OrderStatusTimelineStep[] };

export function OrderStatusTimeline({ steps }: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const dotColor = step.failed
          ? `hsl(${theme.colors.statusError})`
          : step.done
            ? `hsl(${theme.colors.tradeBuy})`
            : step.active
              ? `hsl(${theme.colors.brandPrimary})`
              : `hsl(${theme.colors.foregroundSecondary} / 0.35)`;

        return (
          <View key={step.key} style={styles.row}>
            <View style={styles.col}>
              <View style={[styles.dot, { backgroundColor: dotColor }]}>
                {step.done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
              </View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: step.active || step.done ? '700' : '500',
                  color: step.active || step.done
                    ? `hsl(${theme.colors.foregroundPrimary})`
                    : `hsl(${theme.colors.foregroundSecondary})`,
                  marginTop: 4,
                }}
              >
                {step.label}
              </Text>
            </View>
            {!last ? (
              <View
                style={[
                  styles.line,
                  { backgroundColor: step.done ? `hsl(${theme.colors.tradeBuy})` : `hsl(${theme.colors.borderDefault})` },
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 12 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  col: { alignItems: 'center', minWidth: 64 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { flex: 1, height: 2, marginTop: -18, marginHorizontal: 2 },
});
