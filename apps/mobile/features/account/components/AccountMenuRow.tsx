import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';

type Props = {
  label: string;
  sub?: string;
  badge?: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  testID?: string;
};

export function AccountMenuRow({ label, sub, badge, icon, onPress, testID }: Props) {
  const { theme } = useTheme();
  return (
    <Pressable
      style={[styles.row, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={styles.left}>
        {icon ? (
          <View style={[styles.iconWrap, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)` }]}>
            <Ionicons name={icon} size={18} color={`hsl(${theme.colors.brandPrimary})`} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600', fontSize: 14 }}>
            {label}
          </Text>
          {sub ? (
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 2 }}>
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
      {badge != null ? (
        <View style={[styles.badge, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.15)` }]}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '700', fontSize: 12 }}>{badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={`hsl(${theme.colors.foregroundSecondary})`} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, minWidth: 24, alignItems: 'center' },
});
