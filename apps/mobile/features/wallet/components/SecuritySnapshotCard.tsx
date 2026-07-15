import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard, SkeletonList } from '@shared/ui';
import { useTheme } from '@shared/theme';

type Props = {
  loading: boolean;
  totpEnabled: boolean;
  hasEmail: boolean;
  onManageSecurity: () => void;
};

export function SecuritySnapshotCard({ loading, totpEnabled, hasEmail, onManageSecurity }: Props) {
  const { theme } = useTheme();

  return (
    <ExchangeCard elevated style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.1)` }]}>
          <Ionicons name="shield-checkmark-outline" size={18} color={`hsl(${theme.colors.brandPrimary})`} />
        </View>
        <View>
          <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Security</Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>From your account</Text>
        </View>
      </View>

      {loading ? (
        <SkeletonList rows={2} />
      ) : (
        <View style={{ gap: 8, marginTop: 10 }}>
          <View style={[styles.row, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)` }]}>
            <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 13 }}>Authenticator (2FA)</Text>
            <Text
              style={[
                styles.badge,
                {
                  color: totpEnabled ? `hsl(${theme.colors.tradeBuy})` : `hsl(${theme.colors.foregroundSecondary})`,
                  backgroundColor: totpEnabled
                    ? `hsl(${theme.colors.tradeBuy} / 0.12)`
                    : `hsl(${theme.colors.surfaceMuted})`,
                },
              ]}
            >
              {totpEnabled ? 'On' : 'Off'}
            </Text>
          </View>
          <View style={[styles.row, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)` }]}>
            <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 13 }}>Email on file</Text>
            <Text
              style={[
                styles.badge,
                {
                  color: hasEmail ? `hsl(${theme.colors.tradeBuy})` : `hsl(${theme.colors.tradeSell})`,
                  backgroundColor: hasEmail
                    ? `hsl(${theme.colors.tradeBuy} / 0.12)`
                    : `hsl(${theme.colors.tradeSell} / 0.12)`,
                },
              ]}
            >
              {hasEmail ? 'Yes' : 'Add'}
            </Text>
          </View>
        </View>
      )}

      <Pressable onPress={onManageSecurity} style={styles.link}>
        <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 12 }}>
          Manage security
        </Text>
        <Ionicons name="chevron-forward" size={14} color={`hsl(${theme.colors.brandPrimary})`} />
      </Pressable>
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
});
