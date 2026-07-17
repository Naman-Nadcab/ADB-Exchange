import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import type { OrderStatusTimelineStep } from '@core/domain/p2p/orderRoom';

type Props = { steps: OrderStatusTimelineStep[] };

export function OrderStatusTimeline({ steps }: Props) {
  const { theme } = useTheme();

  return (
    <View style={[styles.wrap, { marginVertical: theme.spacing[3] }]}>
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
              <View
                style={[
                  styles.dot,
                  {
                    width: 28,
                    height: 28,
                    borderRadius: theme.radius.full,
                    backgroundColor: dotColor,
                  },
                ]}
              >
                {step.done ? (
                  <Ionicons name="checkmark" size={theme.sizes.iconXs} color={`hsl(${theme.colors.destructiveForeground})`} />
                ) : null}
              </View>
              <Text
                style={[
                  theme.typography.labelSm,
                  {
                    fontFamily: step.active || step.done ? theme.fonts.sansBold : theme.fonts.sansMedium,
                    color: step.active || step.done
                      ? `hsl(${theme.colors.foregroundPrimary})`
                      : `hsl(${theme.colors.foregroundSecondary})`,
                    marginTop: theme.spacing[1],
                  },
                ]}
              >
                {step.label}
              </Text>
            </View>
            {!last ? (
              <View
                style={[
                  styles.line,
                  {
                    backgroundColor: step.done ? `hsl(${theme.colors.tradeBuy})` : `hsl(${theme.colors.borderDefault})`,
                  },
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
  wrap: { flexDirection: 'row', alignItems: 'flex-start' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  col: { alignItems: 'center', minWidth: 64 },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { flex: 1, height: 2, marginTop: -18, marginHorizontal: 2 },
});
