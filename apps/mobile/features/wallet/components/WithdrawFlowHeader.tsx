import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from '@shared/ui';
import { useTheme } from '@shared/theme';

type Props = {
  symbol: string;
  name?: string;
  network?: string;
  available?: string;
  withdrawEnabled?: boolean;
  step?: string;
};

export function WithdrawFlowHeader({ symbol, name, network, available, withdrawEnabled, step }: Props) {
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
          {available != null ? (
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 2 }}>
              Available: {available} {symbol}
            </Text>
          ) : null}
        </View>
        {withdrawEnabled != null ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: withdrawEnabled
                  ? `hsl(${theme.colors.tradeBuy} / 0.12)`
                  : `hsl(${theme.colors.statusWarning} / 0.12)`,
              },
            ]}
          >
            <Text
              style={{
                color: withdrawEnabled ? `hsl(${theme.colors.tradeBuy})` : `hsl(${theme.colors.statusWarning})`,
                fontSize: 10,
                fontWeight: '700',
              }}
            >
              {withdrawEnabled ? 'WITHDRAW ON' : 'MAINTENANCE'}
            </Text>
          </View>
        ) : null}
      </View>
      {network ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 8 }}>
          Network: {network}
        </Text>
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
});
