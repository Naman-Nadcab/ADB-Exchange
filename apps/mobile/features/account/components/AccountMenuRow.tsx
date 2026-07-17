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
  const density = theme.listDensity.settings;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: `hsl(${theme.colors.borderDefault})`,
          paddingVertical: theme.spacing[3.5],
          minHeight: density.rowHeight,
          gap: density.gap,
          opacity: pressed ? theme.opacity.pressed : 1,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={[styles.left, { gap: theme.spacing[3] }]}>
        {icon ? (
          <View
            style={[
              styles.iconWrap,
              {
                width: theme.sizes.avatarMd - 4,
                height: theme.sizes.avatarMd - 4,
                borderRadius: theme.radius.md + 2,
                backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)`,
              },
            ]}
          >
            <Ionicons name={icon} size={theme.sizes.iconXs + 2} color={`hsl(${theme.colors.brandPrimary})`} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold }]}>
            {label}
          </Text>
          {sub ? (
            <Text
              style={[
                theme.typography.bodySm,
                { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
              ]}
            >
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
      {badge != null ? (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.15)`,
              paddingHorizontal: theme.spacing[2],
              paddingVertical: theme.spacing[0.5] + 1,
              borderRadius: theme.radius.md + 2,
              minWidth: theme.spacing[6],
            },
          ]}
        >
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansBold }]}>
            {badge}
          </Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={theme.sizes.iconXs + 2} color={`hsl(${theme.colors.foregroundSecondary})`} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  badge: { alignItems: 'center' },
});
