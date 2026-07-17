import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { statusChipPalette, type StatusChipTone } from '@shared/theme/statusPalettes';

export type { StatusChipTone };

type Props = {
  label: string;
  tone?: StatusChipTone;
  pulse?: boolean;
  testID?: string;
};

export function StatusChip({ label, tone = 'neutral', pulse, testID }: Props) {
  const { theme } = useTheme();
  const palette = statusChipPalette(theme.colors, tone);

  return (
    <View
      testID={testID}
      style={[
        styles.chip,
        {
          gap: theme.spacing[1],
          borderRadius: theme.radius.full,
          paddingHorizontal: theme.spacing[1.5],
          paddingVertical: theme.spacing[0.5],
          borderColor: palette.border,
          backgroundColor: palette.bg,
        },
      ]}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: palette.dot,
            opacity: pulse ? theme.opacity.pressed : 1,
          },
        ]}
      />
      <Text
        style={[
          theme.typography.labelSm,
          {
            color: palette.fg,
            fontFamily: theme.fonts.sansSemiBold,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
