import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';

type Props = {
  step?: string;
};

export function TransferFlowHeader({ step }: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700', fontSize: 20 }}>
        Internal transfer
      </Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, marginTop: 4 }}>
        Move assets between your wallets instantly. No network fees.
      </Text>
      {step ? (
        <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 11, fontWeight: '600', marginTop: 8 }}>
          {step}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
});
