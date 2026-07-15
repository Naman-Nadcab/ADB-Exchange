import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import type { AccountType } from '@exchange/mobile-types';
import { TRANSFER_ACCOUNT_OPTIONS } from '@core/domain/wallet/transfer';

type Props = {
  accountType: AccountType;
  onChange: (a: AccountType) => void;
};

export function ConvertAccountSection({ accountType, onChange }: Props) {
  const { theme } = useTheme();

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>ACCOUNT</Text>
      <View style={styles.options}>
        {TRANSFER_ACCOUNT_OPTIONS.map((opt) => {
          const active = opt.id === accountType;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={[
                styles.chip,
                {
                  borderColor: `hsl(${theme.colors.borderDefault})`,
                  backgroundColor: active ? `hsl(${theme.colors.brandPrimary} / 0.12)` : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: active ? `hsl(${theme.colors.brandPrimary})` : `hsl(${theme.colors.foregroundPrimary})`,
                  fontWeight: active ? '700' : '500',
                  fontSize: 12,
                }}
              >
                {opt.label.replace(' Account', '')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, padding: 14 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, minHeight: 36 },
});
