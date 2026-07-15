import { View, Text, StyleSheet, Share, Alert, Pressable, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
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
    <ExchangeCard elevated style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>DEPOSIT ADDRESS</Text>
        {onRefresh ? (
          <Pressable onPress={onRefresh} hitSlop={10} accessibilityLabel="Refresh address">
            {loading ? (
              <ActivityIndicator size="small" color={`hsl(${theme.colors.brandPrimary})`} />
            ) : (
              <Ionicons name="refresh" size={20} color={`hsl(${theme.colors.foregroundSecondary})`} />
            )}
          </Pressable>
        ) : null}
      </View>

      {chainName ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 10, fontSize: 13 }}>
          Network: {chainName}
          {confirmations != null ? ` · ${confirmations} confirmations` : ''}
        </Text>
      ) : null}

      <View style={styles.qr}>
        {loading ? (
          <ActivityIndicator size="large" color={`hsl(${theme.colors.brandPrimary})`} />
        ) : (
          <QRCode value={qrValue} size={180} />
        )}
      </View>

      <Text
        selectable
        style={[styles.address, { color: `hsl(${theme.colors.foregroundPrimary})` }]}
        accessibilityLabel="Deposit address"
      >
        {address}
      </Text>

      {memo ? (
        <View style={[styles.memoBox, { backgroundColor: `hsl(${theme.colors.statusWarning} / 0.1)` }]}>
          <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontWeight: '700', fontSize: 12 }}>
            Memo / Tag required
          </Text>
          <Text
            selectable
            style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: 'monospace', marginTop: 4 }}
          >
            {memo}
          </Text>
          <PrimaryButton title="Copy Memo" variant="secondary" onPress={() => void onCopyMemo()} />
        </View>
      ) : null}

      {notice ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 10, textAlign: 'center' }}>
          {notice}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton title="Copy Address" variant="secondary" onPress={() => void onCopyAddress()} />
        <PrimaryButton title="Share" variant="secondary" onPress={() => void onShare()} />
      </View>
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, alignItems: 'stretch' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  qr: {
    alignSelf: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 10,
    minHeight: 204,
    minWidth: 204,
    alignItems: 'center',
    justifyContent: 'center',
  },
  address: { fontSize: 13, textAlign: 'center', fontFamily: 'monospace', lineHeight: 20 },
  memoBox: { marginTop: 12, padding: 12, borderRadius: 10, gap: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
});
