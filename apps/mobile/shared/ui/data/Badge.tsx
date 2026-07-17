import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { semanticStatusPalette, type SemanticStatusTone } from '@shared/theme/statusPalettes';

type Props = {
  label: string | number;
  tone?: SemanticStatusTone | 'default';
  testID?: string;
};

export function Badge({ label, tone = 'default', testID }: Props) {
  const { theme } = useTheme();
  const palette = semanticStatusPalette(theme.colors, tone === 'default' ? 'brand' : tone);

  return (
    <View
      testID={testID}
      style={[
        styles.badge,
        {
          borderRadius: theme.radius.full,
          paddingHorizontal: theme.spacing[2],
          paddingVertical: theme.spacing[0.5],
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
      ]}
    >
      <Text style={[theme.typography.labelSm, { color: palette.fg, fontFamily: theme.fonts.sansSemiBold }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
});
