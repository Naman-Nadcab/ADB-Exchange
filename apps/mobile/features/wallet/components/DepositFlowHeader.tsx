import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@shared/ui';
import { useTheme } from '@shared/theme';

type Props = {
  symbol: string;
  name?: string;
  network?: string;
  depositEnabled?: boolean;
  step?: string;
};

export function DepositFlowHeader({ symbol, name, network, depositEnabled, step }: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Avatar name={symbol} size="md" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700', fontSize: 18 }}>
            {name ?? symbol}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>{symbol}</Text>
        </View>
        {depositEnabled != null ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: depositEnabled
                  ? `hsl(${theme.colors.tradeBuy} / 0.12)`
                  : `hsl(${theme.colors.statusWarning} / 0.12)`,
              },
            ]}
          >
            <Text
              style={{
                color: depositEnabled ? `hsl(${theme.colors.tradeBuy})` : `hsl(${theme.colors.statusWarning})`,
                fontSize: 10,
                fontWeight: '700',
              }}
            >
              {depositEnabled ? 'DEPOSIT ON' : 'MAINTENANCE'}
            </Text>
          </View>
        ) : null}
      </View>
      {network ? (
        <View style={styles.networkRow}>
          <Ionicons name="git-network-outline" size={14} color={`hsl(${theme.colors.foregroundSecondary})`} />
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>{network}</Text>
        </View>
      ) : null}
      {step ? (
        <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 11, fontWeight: '600', marginTop: 6 }}>
          {step}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  networkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
});
