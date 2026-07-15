import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticLight } from '@shared/theme';
import {
  formatPaymentDetailKey,
  pickPaymentDetail,
} from '@core/domain/p2p/orderRoom';

type Props = {
  details: Record<string, unknown>;
  displayName?: string | null;
};

function DetailRow({
  label,
  value,
  copyKey,
  copied,
  onCopy,
  theme,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: string | null;
  onCopy: (key: string, value: string) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View style={[styles.row, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: `hsl(${theme.colors.foregroundSecondary})`, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <View style={styles.rowValue}>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: `hsl(${theme.colors.foregroundPrimary})` }}>
          {value || '—'}
        </Text>
        {value ? (
          <Pressable onPress={() => onCopy(copyKey, value)} hitSlop={8}>
            <Ionicons
              name={copied === copyKey ? 'checkmark-circle' : 'copy-outline'}
              size={16}
              color={copied === copyKey ? `hsl(${theme.colors.tradeBuy})` : `hsl(${theme.colors.foregroundSecondary})`}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function OrderPaymentInstructions({ details, displayName }: Props) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState<string | null>(null);

  const accountName = pickPaymentDetail(details, [
    'account_name', 'accountName', 'holder_name', 'holderName', 'name', 'beneficiary_name', 'beneficiaryName',
  ]);
  const bankName = pickPaymentDetail(details, ['bank_name', 'bankName', 'bank', 'institution']);
  const accountNumber = pickPaymentDetail(details, [
    'account_number', 'accountNumber', 'account_no', 'accountNo', 'upi_id', 'upiId',
  ]);
  const iban = pickPaymentDetail(details, ['iban', 'IBAN']);
  const routing = pickPaymentDetail(details, [
    'ifsc', 'IFSC', 'routing_number', 'routingNumber', 'swift', 'SWIFT', 'bic', 'sort_code', 'sortCode',
  ]);

  const knownKeys = new Set([
    'account_name', 'accountName', 'holder_name', 'holderName', 'name', 'beneficiary_name', 'beneficiaryName',
    'bank_name', 'bankName', 'bank', 'institution',
    'account_number', 'accountNumber', 'account_no', 'accountNo', 'upi_id', 'upiId',
    'iban', 'IBAN',
    'ifsc', 'routing_number', 'routingNumber', 'swift', 'SWIFT', 'bic', 'sort_code', 'sortCode',
  ]);

  const extras = useMemo(
    () => Object.entries(details).filter(([k, v]) => !knownKeys.has(k) && v != null && String(v).trim() !== ''),
    [details],
  );

  const onCopy = async (key: string, value: string) => {
    hapticLight();
    await Clipboard.setStringAsync(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <View style={[styles.wrap, { borderColor: 'rgba(245,158,11,0.2)', backgroundColor: 'rgba(245,158,11,0.04)' }]}>
      <View style={[styles.warning, { borderColor: 'rgba(245,158,11,0.2)', backgroundColor: 'rgba(245,158,11,0.06)' }]}>
        <Ionicons name="warning-outline" size={18} color="#f59e0b" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#f59e0b', fontWeight: '700', marginBottom: 4 }}>Payment Safety</Text>
          <Text style={{ color: '#f59e0b', fontSize: 12, lineHeight: 18 }}>
            Do not write crypto or exchange names in the bank transfer note.{'\n'}
            Only release crypto after you confirm fiat arrived in your account.
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 16, fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})`, marginBottom: 6 }}>
        Send Payment To
      </Text>
      {displayName ? (
        <Text style={{ fontSize: 13, color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 8 }}>
          Method: <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>{displayName}</Text>
        </Text>
      ) : null}

      <View style={[styles.detailsCard, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
        <DetailRow label="Account Name" value={accountName} copyKey="account_name" copied={copied} onCopy={onCopy} theme={theme} />
        <DetailRow label="Bank / Institution" value={bankName} copyKey="bank" copied={copied} onCopy={onCopy} theme={theme} />
        <DetailRow label="Account Number / UPI" value={accountNumber} copyKey="account" copied={copied} onCopy={onCopy} theme={theme} />
        {iban ? <DetailRow label="IBAN" value={iban} copyKey="iban" copied={copied} onCopy={onCopy} theme={theme} /> : null}
        <DetailRow label="IFSC / Routing / SWIFT" value={routing} copyKey="routing" copied={copied} onCopy={onCopy} theme={theme} />
      </View>

      {extras.length > 0 ? (
        <View style={[styles.extras, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 8 }}>
            ADDITIONAL DETAILS
          </Text>
          {extras.map(([k, v]) => (
            <View key={k} style={styles.extraRow}>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>{formatPaymentDetailKey(k)}</Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' }}>
                {String(v)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  warning: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 12 },
  detailsCard: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  rowValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  extras: { marginTop: 10, borderWidth: 1, borderRadius: 8, padding: 10 },
  extraRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
});
