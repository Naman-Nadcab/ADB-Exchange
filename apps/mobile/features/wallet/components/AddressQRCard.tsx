import { View, Text, StyleSheet, Share, Alert, Pressable, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hsl } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import { PrimaryButton, ExchangeCard } from '@shared/ui';
import { clipboardPolicy } from '@core/security/clipboardPolicy';

type Props = {
  address: string;
  qrData: string;
  memo?: string;
  notice?: string;
  chainName?: string;
  confirmations?: number;
  loading?: boolean;
  onRefresh?: () => void;
};

export function AddressQRCard({
  address,
  qrData,
  memo,
  notice,
  chainName,
  confirmations,
  loading,
  onRefresh,
}: Props) {
  const { theme } = useTheme();
  const warning = semanticStatusPalette(theme.colors, 'warning');
  const qrValue = qrData || (memo ? `${address}:${memo}` : address);

  const onCopyAddress = async () => {
    await clipboardPolicy.copyWithExpiry(address);
    Alert.alert('Copied', 'Address copied. Clipboard clears in 60 seconds.');
  };

  const onCopyMemo = async () => {
    if (!memo) return;
    await clipboardPolicy.copyWithExpiry(memo);
    Alert.alert('Copied', 'Memo copied. Clipboard clears in 60 seconds.');
  };

  const onShare = async () => {
    const lines = [`Address: ${address}`];
    if (memo) lines.push(`Memo/Tag: ${memo}`);
    if (chainName) lines.push(`Network: ${chainName}`);
    await Share.share({ message: lines.join('\n') });
  };

  return (
    <ExchangeCard elevated style={{ marginBottom: theme.spacing[3.5], alignItems: 'stretch' }}>
      <View style={[styles.headerRow, { marginBottom: theme.spacing[1] }]}>
        <Text
          style={[
            theme.typography.labelSm,
            {
              color: hsl(theme.colors.foregroundSecondary),
              fontFamily: theme.fonts.sansBold,
              letterSpacing: 1.1,
            },
          ]}
        >
          DEPOSIT ADDRESS
        </Text>
        {onRefresh ? (
          <Pressable onPress={onRefresh} hitSlop={10} accessibilityLabel="Refresh address">
            {loading ? (
              <ActivityIndicator size="small" color={hsl(theme.colors.brandPrimary)} />
            ) : (
              <Ionicons name="refresh" size={theme.sizes.iconSm} color={hsl(theme.colors.foregroundSecondary)} />
            )}
          </Pressable>
        ) : null}
      </View>

      {chainName ? (
        <Text
          style={[
            theme.typography.bodyMd,
            { color: hsl(theme.colors.foregroundSecondary), marginBottom: theme.spacing[2.5] },
          ]}
        >
          Network: {chainName}
          {confirmations != null ? ` · ${confirmations} confirmations` : ''}
        </Text>
      ) : null}

      <View
        style={[
          styles.qr,
          {
            padding: theme.spacing[3],
            borderRadius: theme.radius.lg,
            marginVertical: theme.spacing[2.5],
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="large" color={hsl(theme.colors.brandPrimary)} />
        ) : (
          <QRCode value={qrValue} size={180} />
        )}
      </View>

      <Text
        selectable
        style={[
          theme.typography.bodyMd,
          {
            color: hsl(theme.colors.foregroundPrimary),
            textAlign: 'center',
            fontFamily: 'monospace',
            lineHeight: 20,
          },
        ]}
        accessibilityLabel="Deposit address"
      >
        {address}
      </Text>

      {memo ? (
        <View
          style={[
            styles.memoBox,
            {
              backgroundColor: warning.bg,
              marginTop: theme.spacing[3],
              padding: theme.spacing[3],
              borderRadius: theme.radius.md + 2,
              gap: theme.spacing[2],
            },
          ]}
        >
          <Text
            style={[
              theme.typography.bodySm,
              { color: warning.fg, fontFamily: theme.fonts.sansBold },
            ]}
          >
            Memo / Tag required
          </Text>
          <Text
            selectable
            style={[
              theme.typography.bodyMd,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: 'monospace', marginTop: theme.spacing[1] },
            ]}
          >
            {memo}
          </Text>
          <PrimaryButton title="Copy Memo" variant="secondary" onPress={() => void onCopyMemo()} />
        </View>
      ) : null}

      {notice ? (
        <Text
          style={[
            theme.typography.bodySm,
            {
              color: hsl(theme.colors.foregroundSecondary),
              marginTop: theme.spacing[2.5],
              textAlign: 'center',
            },
          ]}
        >
          {notice}
        </Text>
      ) : null}

      <View style={[styles.actions, { gap: theme.spacing[2], marginTop: theme.spacing[3.5] }]}>
        <PrimaryButton title="Copy Address" variant="secondary" onPress={() => void onCopyAddress()} />
        <PrimaryButton title="Share" variant="secondary" onPress={() => void onShare()} />
      </View>
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qr: {
    alignSelf: 'center',
    backgroundColor: '#fff',
    minHeight: 204,
    minWidth: 204,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoBox: {},
  actions: { flexDirection: 'row' },
});
