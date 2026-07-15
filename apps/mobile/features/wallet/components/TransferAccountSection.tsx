import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import type { AccountType } from '@exchange/mobile-types';
import { TRANSFER_ACCOUNT_OPTIONS, transferAccountLabel } from '@core/domain/wallet/transfer';

type Props = {
  fromAccount: AccountType;
  toAccount: AccountType;
  onFromChange: (a: AccountType) => void;
  onToChange: (a: AccountType) => void;
  onSwap: () => void;
};

export function TransferAccountSection({ fromAccount, toAccount, onFromChange, onToChange, onSwap }: Props) {
  const { theme } = useTheme();

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <AccountRow
        label="FROM"
        subtitle="Available for transfer"
        account={fromAccount}
        disabledAccount={toAccount}
        onSelect={onFromChange}
        theme={theme}
      />
      <Pressable
        onPress={onSwap}
        accessibilityLabel="Swap transfer direction"
        style={[styles.swap, { borderColor: `hsl(${theme.colors.borderDefault})` }]}
      >
        <Ionicons name="swap-vertical" size={20} color={`hsl(${theme.colors.brandPrimary})`} />
      </Pressable>
      <AccountRow
        label="TO"
        subtitle="Receive assets"
        account={toAccount}
        disabledAccount={fromAccount}
        onSelect={onToChange}
        theme={theme}
      />
    </ExchangeCard>
  );
}

function AccountRow({
  label,
  subtitle,
  account,
  disabledAccount,
  onSelect,
  theme,
}: {
  label: string;
  subtitle: string;
  account: AccountType;
  disabledAccount: AccountType;
  onSelect: (a: AccountType) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{label}</Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700', fontSize: 16 }}>
        {transferAccountLabel(account)}
      </Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>{subtitle}</Text>
      <View style={styles.options}>
        {TRANSFER_ACCOUNT_OPTIONS.map((opt) => {
          const disabled = opt.id === disabledAccount;
          const active = opt.id === account;
          return (
            <Pressable
              key={opt.id}
              disabled={disabled}
              onPress={() => onSelect(opt.id)}
              style={[
                styles.chip,
                {
                  borderColor: `hsl(${theme.colors.borderDefault})`,
                  backgroundColor: active ? `hsl(${theme.colors.brandPrimary} / 0.12)` : 'transparent',
                  opacity: disabled ? 0.4 : 1,
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, padding: 14, gap: 8 },
  block: { gap: 4 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, minHeight: 36 },
  swap: { alignSelf: 'center', padding: 10, borderRadius: 10, borderWidth: 1 },
});
