import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  label: string;
  sub?: string;
  badge?: string | number;
  onPress: () => void;
  testID?: string;
};

export function AccountMenuRow({ label, sub, badge, onPress, testID }: Props) {
  const { theme } = useTheme();
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>{label}</Text>
      {sub ? <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>{sub}</Text> : null}
      {badge != null ? (
        <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '700' }}>{badge}</Text>
      ) : (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>›</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
