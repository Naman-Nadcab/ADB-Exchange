import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import type { EscrowTimelineStep } from '@core/domain/p2p/order';

type Props = { steps: EscrowTimelineStep[] };

export function OrderTimeline({ steps }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, { marginVertical: theme.spacing[3], gap: theme.spacing[2] }]}>
      {steps.map((s) => (
        <View key={s.key} style={[styles.step, { gap: theme.spacing[2] }]}>
          <View
            style={[
              styles.dot,
              {
                width: 10,
                height: 10,
                borderRadius: theme.radius.full,
                backgroundColor: s.active
                  ? `hsl(${theme.colors.brandPrimary})`
                  : s.done
                    ? `hsl(${theme.colors.tradeBuy})`
                    : `hsl(${theme.colors.foregroundSecondary})`,
              },
            ]}
          />
          <Text
            style={[
              theme.typography.bodySm,
              {
                color: `hsl(${s.active ? theme.colors.foregroundPrimary : theme.colors.foregroundSecondary})`,
                fontFamily: s.active ? theme.fonts.sansBold : theme.fonts.sans,
              },
            ]}
          >
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  step: { flexDirection: 'row', alignItems: 'center' },
  dot: {},
});
