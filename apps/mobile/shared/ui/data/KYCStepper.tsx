import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';

type Step = { key: string; label: string };

type Props = {
  steps: Step[];
  currentIndex: number;
  testID?: string;
};

export function KYCStepper({ steps, currentIndex, testID }: Props) {
  const { theme } = useTheme();
  return (
    <View testID={testID} style={[styles.row, { gap: theme.spacing[2], marginBottom: theme.spacing[5] }]}>
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const color = done || active ? theme.colors.brandPrimary : theme.colors.foregroundSecondary;
        return (
          <View key={step.key} style={styles.step}>
            <View
              style={[
                styles.circle,
                {
                  borderColor: `hsl(${color})`,
                  backgroundColor: done ? `hsl(${theme.colors.brandPrimary})` : 'transparent',
                },
              ]}
            >
              {done ? (
                <Ionicons name="checkmark" size={12} color={`hsl(${theme.colors.brandPrimaryForeground})`} />
              ) : (
                <Text style={[theme.typography.labelSm, { color: `hsl(${color})` }]}>{i + 1}</Text>
              )}
            </View>
            <Text
              numberOfLines={1}
              style={[
                theme.typography.labelSm,
                {
                  color: `hsl(${active ? theme.colors.foregroundPrimary : theme.colors.foregroundSecondary})`,
                  marginTop: 4,
                  textAlign: 'center',
                },
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center' },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
