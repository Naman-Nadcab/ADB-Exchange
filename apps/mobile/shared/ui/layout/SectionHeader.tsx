import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

export function SectionHeader({ title, subtitle, actionLabel, onAction, testID }: Props) {
  const { theme } = useTheme();
  return (
    <View testID={testID} style={[styles.row, { marginBottom: theme.spacing.sectionGap }]}>
      <View style={[styles.textCol, { paddingRight: theme.spacing[2] }]}>
        <Text
          style={[
            theme.typography.headingMd,
            { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={theme.spacing[2]}
          accessibilityRole="button"
          style={({ pressed }) => ({ opacity: pressed ? theme.opacity.pressed : 1 })}
        >
          <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansSemiBold }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textCol: { flex: 1 },
});
