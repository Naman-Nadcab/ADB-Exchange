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
    <View testID={testID} style={[styles.row, { marginBottom: theme.spacing[3] }]}>
      <View style={styles.textCol}>
        <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[theme.typography.labelMd, { color: `hsl(${theme.colors.brandPrimary})` }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  textCol: { flex: 1 },
});
