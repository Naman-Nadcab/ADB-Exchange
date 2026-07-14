import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';

type Props = {
  verified?: boolean;
  completionRate?: number;
  testID?: string;
};

export function MerchantBadge({ verified, completionRate, testID }: Props) {
  const { theme } = useTheme();
  return (
    <View testID={testID} style={styles.row}>
      {verified ? (
        <View style={[styles.pill, { backgroundColor: `hsl(${theme.colors.tradeBuy} / 0.12)`, borderColor: `hsl(${theme.colors.tradeBuy} / 0.3)` }]}>
          <Ionicons name="shield-checkmark" size={12} color={`hsl(${theme.colors.tradeBuy})`} />
          <Text style={[styles.text, { color: `hsl(${theme.colors.tradeBuy})` }]}>Verified</Text>
        </View>
      ) : null}
      {completionRate != null ? (
        <View style={[styles.pill, { backgroundColor: `hsl(${theme.colors.surfaceMuted})`, borderColor: `hsl(${theme.colors.borderDefault})` }]}>
          <Text style={[styles.text, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{completionRate}%</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: { fontSize: 11, fontWeight: '600' },
});
