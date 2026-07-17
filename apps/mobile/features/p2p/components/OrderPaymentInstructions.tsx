import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard } from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
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
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: string | null;
  onCopy: (key: string, value: string) => void;
}) {
  const { theme } = useTheme();
  const success = semanticStatusPalette(theme.colors, 'success');
  return (
    <View
      style={[
        styles.row,
        {
          paddingVertical: theme.spacing[2.5],
          borderBottomColor: `hsl(${theme.colors.borderDefault})`,
          gap: theme.spacing[1],
        },
      ]}
    >
      <Text
        style={[
          theme.typography.labelSm,
          {
            color: `hsl(${theme.colors.foregroundSecondary})`,
            fontFamily: theme.fonts.sansBold,
            textTransform: 'uppercase',
          },
        ]}
      >
        {label}
      </Text>
      <View style={[styles.rowValue, { gap: theme.spacing[2] }]}>
        <Text
          style={[
            theme.typography.bodyMd,
            { flex: 1, color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
          ]}
        >
          {value || '—'}
        </Text>
        {value ? (
          <Pressable onPress={() => onCopy(copyKey, value)} hitSlop={8}>
            <Ionicons
              name={copied === copyKey ? 'checkmark-circle' : 'copy-outline'}
              size={theme.sizes.iconSm}
              color={copied === copyKey ? success.fg : `hsl(${theme.colors.foregroundSecondary})`}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function OrderPaymentInstructions({ details, displayName }: Props) {
  const { theme } = useTheme();
  const warning = semanticStatusPalette(theme.colors, 'warning');
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
    <View
      style={[
        styles.wrap,
        {
          borderColor: warning.border,
          backgroundColor: warning.bg,
          borderRadius: theme.radius.lg,
          padding: theme.spacing[3.5],
          marginBottom: theme.spacing[3],
        },
      ]}
    >
      <View
        style={[
          styles.warning,
          {
            borderColor: warning.border,
            backgroundColor: warning.bg,
            borderRadius: theme.radius.md,
            padding: theme.spacing[2.5],
            marginBottom: theme.spacing[3],
            gap: theme.spacing[2.5],
          },
        ]}
      >
        <Ionicons name="warning-outline" size={theme.sizes.iconMd} color={warning.fg} />
        <View style={{ flex: 1 }}>
          <Text
            style={[
              theme.typography.bodySm,
              { color: warning.fg, fontFamily: theme.fonts.sansBold, marginBottom: theme.spacing[1] },
            ]}
          >
            Payment Safety
          </Text>
          <Text style={[theme.typography.bodySm, { color: warning.fg }]}>
            Do not write crypto or exchange names in the bank transfer note.{'\n'}
            Only release crypto after you confirm fiat arrived in your account.
          </Text>
        </View>
      </View>

      <Text
        style={[
          theme.typography.headingSm,
          { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold, marginBottom: theme.spacing[1.5] },
        ]}
      >
        Send Payment To
      </Text>
      {displayName ? (
        <Text
          style={[
            theme.typography.bodySm,
            { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[2] },
          ]}
        >
          Method:{' '}
          <Text style={{ fontFamily: theme.fonts.sansBold, color: `hsl(${theme.colors.foregroundPrimary})` }}>
            {displayName}
          </Text>
        </Text>
      ) : null}

      <ExchangeCard padded={false} style={{ overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: theme.spacing[3] }}>
          <DetailRow label="Account Name" value={accountName} copyKey="account_name" copied={copied} onCopy={onCopy} />
          <DetailRow label="Bank / Institution" value={bankName} copyKey="bank" copied={copied} onCopy={onCopy} />
          <DetailRow label="Account Number / UPI" value={accountNumber} copyKey="account" copied={copied} onCopy={onCopy} />
          {iban ? <DetailRow label="IBAN" value={iban} copyKey="iban" copied={copied} onCopy={onCopy} /> : null}
          <DetailRow label="IFSC / Routing / SWIFT" value={routing} copyKey="routing" copied={copied} onCopy={onCopy} />
        </View>
      </ExchangeCard>

      {extras.length > 0 ? (
        <View
          style={[
            styles.extras,
            {
              borderColor: `hsl(${theme.colors.borderDefault})`,
              borderRadius: theme.radius.md,
              padding: theme.spacing[2.5],
              marginTop: theme.spacing[2.5],
            },
          ]}
        >
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: `hsl(${theme.colors.foregroundSecondary})`,
                fontFamily: theme.fonts.sansBold,
                marginBottom: theme.spacing[2],
              },
            ]}
          >
            ADDITIONAL DETAILS
          </Text>
          {extras.map(([k, v]) => (
            <View key={k} style={[styles.extraRow, { gap: theme.spacing[2], marginBottom: theme.spacing[1.5] }]}>
              <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
                {formatPaymentDetailKey(k)}
              </Text>
              <Text
                style={[
                  theme.typography.bodySm,
                  {
                    color: `hsl(${theme.colors.foregroundPrimary})`,
                    fontFamily: theme.fonts.sansSemiBold,
                    flex: 1,
                    textAlign: 'right',
                  },
                ]}
              >
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
  wrap: { borderWidth: 1 },
  warning: { flexDirection: 'row', borderWidth: 1 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth },
  rowValue: { flexDirection: 'row', alignItems: 'center' },
  extras: { borderWidth: 1 },
  extraRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
