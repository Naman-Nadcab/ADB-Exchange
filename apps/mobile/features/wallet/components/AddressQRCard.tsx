import { View, Text, StyleSheet, Share, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@shared/theme';
import { PrimaryButton } from '@shared/ui';
import { clipboardPolicy } from '@core/security/clipboardPolicy';

type Props = {
  address: string;
  qrData: string;
  memo?: string;
  notice?: string;
  chainName?: string;
  confirmations?: number;
};

export function AddressQRCard({ address, qrData, memo, notice, chainName, confirmations }: Props) {
  const { theme } = useTheme();

  const onCopy = async () => {
    await clipboardPolicy.copyWithExpiry(memo ? `${address}:${memo}` : address);
    Alert.alert('Copied', 'Address copied. Clipboard will clear in 60 seconds.');
  };

  const onShare = async () => {
    await Share.share({ message: memo ? `Address: ${address}\nMemo: ${memo}` : address });
  };

  return (
    <View style={styles.wrap}>
      {chainName ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 8 }}>
          Network: {chainName}
          {confirmations != null ? ` · ${confirmations} confirmations` : ''}
        </Text>
      ) : null}
      <View style={styles.qr}>
        <QRCode value={qrData || address} size={180} />
      </View>
      <Text
        selectable
        style={[styles.address, { color: `hsl(${theme.colors.foregroundPrimary})` }]}
        accessibilityLabel="Deposit address"
      >
        {address}
      </Text>
      {memo ? (
        <Text style={{ color: `hsl(${theme.colors.statusWarning})`, marginTop: 8, fontWeight: '600' }}>
          Memo/Tag: {memo}
        </Text>
      ) : null}
      {notice ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 8 }}>
          {notice}
        </Text>
      ) : null}
      <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 11, marginTop: 8 }}>
        Only send assets on the selected network. Wrong network may result in permanent loss.
      </Text>
      <View style={styles.actions}>
        <PrimaryButton title="Copy Address" variant="secondary" onPress={() => void onCopy()} />
        <PrimaryButton title="Share" variant="secondary" onPress={() => void onShare()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 12 },
  qr: { padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 12 },
  address: { fontSize: 13, textAlign: 'center', fontFamily: 'monospace' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
