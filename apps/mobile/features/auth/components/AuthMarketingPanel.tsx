import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, marketing } from '@shared/theme';

const FEATURES = [
  { icon: 'cash-outline' as const, label: 'Fiat', value: 'Coming Soon', sub: 'Fiat rails in rollout' },
  { icon: 'shield-checkmark-outline' as const, label: 'Security', value: '2FA + sessions', sub: 'Account protection' },
  { icon: 'logo-bitcoin' as const, label: 'Spot markets', value: 'Live pairs', sub: 'From exchange API' },
];

/** Website AuthSplitLayout left-panel feature grid (mobile). */
export function AuthMarketingPanel() {
  const { theme } = useTheme();

  return (
    <View style={styles.grid}>
      {FEATURES.map((item) => (
        <View key={item.label} style={styles.cell}>
          <View style={[styles.iconWrap, { borderColor: marketing.goldBorder }]}>
            <Ionicons name={item.icon} size={20} color={marketing.gold} />
          </View>
          <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{item.label}</Text>
          <Text style={[styles.value, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{item.value}</Text>
          <Text style={[styles.sub, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{item.sub}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 12, marginBottom: 28, marginTop: 8 },
  cell: { flex: 1 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: marketing.insetHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  sub: { fontSize: 10, lineHeight: 14 },
});
