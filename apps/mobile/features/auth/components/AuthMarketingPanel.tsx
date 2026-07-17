import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';

const FEATURES = [
  { icon: 'cash-outline' as const, label: 'Fiat', value: 'Coming Soon', sub: 'Fiat rails in rollout' },
  { icon: 'shield-checkmark-outline' as const, label: 'Security', value: '2FA + sessions', sub: 'Account protection' },
  { icon: 'logo-bitcoin' as const, label: 'Spot markets', value: 'Live pairs', sub: 'From exchange API' },
];

/** Website AuthSplitLayout left-panel feature grid (mobile). */
export function AuthMarketingPanel() {
  const { theme } = useTheme();
  const m = theme.marketing;

  return (
    <View style={[styles.grid, { gap: theme.spacing[3], marginBottom: theme.spacing[7], marginTop: theme.spacing[2] }]}>
      {FEATURES.map((item) => (
        <View key={item.label} style={styles.cell}>
          <View
            style={[
              styles.iconWrap,
              {
                width: theme.sizes.tapTarget,
                height: theme.sizes.tapTarget,
                borderRadius: theme.radius.lg,
                borderColor: m.goldBorder,
                backgroundColor: m.insetHighlight,
                marginBottom: theme.spacing[2.5],
              },
            ]}
          >
            <Ionicons name={item.icon} size={theme.sizes.iconSm} color={m.gold} />
          </View>
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: `hsl(${theme.colors.foregroundSecondary})`,
                fontFamily: theme.fonts.sansBold,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                marginBottom: theme.spacing[0.5],
              },
            ]}
          >
            {item.label}
          </Text>
          <Text
            style={[
              theme.typography.bodyLg,
              {
                color: `hsl(${theme.colors.foregroundPrimary})`,
                fontFamily: theme.fonts.sansBold,
                marginBottom: theme.spacing[0.5],
              },
            ]}
          >
            {item.value}
          </Text>
          <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            {item.sub}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row' },
  cell: { flex: 1 },
  iconWrap: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
