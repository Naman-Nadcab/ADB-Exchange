import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticLight } from '@shared/theme';
import { getApiBaseUrl } from '@core/config/env';
import { useAuthStore } from '@core/state/authStore';
import type { P2POrder } from '@exchange/mobile-types';
import { orderStatusLabel, verificationBadgeLabel } from '@core/domain/p2p/orderRoom';
import { formatFiatSymbol } from '@core/domain/p2p/marketplace';

type Props = {
  order: P2POrder;
  isBuyer: boolean;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return globalThis.btoa(binary);
}

function PaymentProofViewer({ orderId, paymentProofUrl }: { orderId: string; paymentProofUrl: string }) {
  const { theme } = useTheme();
  const token = useAuthStore((s) => s.accessToken);
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isSecure = paymentProofUrl.startsWith('secure:');

  const loadSecure = async () => {
    if (!token) {
      setErr('Not signed in');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const base = getApiBaseUrl().replace(/\/$/, '');
      const res = await fetch(`${base}/p2p/orders/${encodeURIComponent(orderId)}/payment-proof`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const contentType = res.headers.get('content-type') ?? 'image/jpeg';
      const buf = await res.arrayBuffer();
      const dataUrl = `data:${contentType};base64,${arrayBufferToBase64(buf)}`;
      setUri(dataUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load proof');
    } finally {
      setLoading(false);
    }
  };

  if (isSecure) {
    return (
      <View style={styles.proofWrap}>
        <Pressable onPress={() => void loadSecure()} disabled={loading}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>
            {loading ? 'Loading…' : uri ? 'Reload proof' : 'View payment proof'}
          </Text>
        </Pressable>
        {err ? <Text style={{ color: `hsl(${theme.colors.statusError})`, fontSize: 12 }}>{err}</Text> : null}
        {loading ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
        {uri ? <Image source={{ uri }} style={styles.proofImage} resizeMode="contain" /> : null}
      </View>
    );
  }

  const href = paymentProofUrl.startsWith('http') ? paymentProofUrl : paymentProofUrl;
  return (
    <Image source={{ uri: href }} style={styles.proofImage} resizeMode="contain" />
  );
}

function InfoCell({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <View style={styles.cell}>
      <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>{value}</Text>
    </View>
  );
}

export function OrderRoomSummary({ order, isBuyer }: Props) {
  const { theme } = useTheme();
  const fiat = order.fiat_currency ?? 'USD';
  const sym = formatFiatSymbol(fiat);
  const vBadge = verificationBadgeLabel(order.payment_verification_status);
  const counterparty = isBuyer ? order.seller_username ?? '—' : order.buyer_username ?? '—';

  const statusTone =
    order.status === 'payment_pending'
      ? '#f59e0b'
      : order.status === 'payment_confirmed'
        ? '#3b82f6'
        : order.status === 'completed' || order.status === 'released'
          ? `hsl(${theme.colors.tradeBuy})`
          : order.status === 'disputed'
            ? `hsl(${theme.colors.statusError})`
            : `hsl(${theme.colors.foregroundSecondary})`;

  return (
    <View style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
      <View style={[styles.header, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
          Order Details
        </Text>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: `${statusTone}18` }]}>
            <Text style={{ color: statusTone, fontSize: 11, fontWeight: '700' }}>{orderStatusLabel(order.status)}</Text>
          </View>
          {vBadge ? (
            <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '700' }}>{vBadge.label}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {!isBuyer && order.status === 'payment_confirmed' && order.payment_verification_status === 'pending' ? (
        <Text style={[styles.hint, { color: '#f59e0b', borderColor: 'rgba(245,158,11,0.2)', backgroundColor: 'rgba(245,158,11,0.06)' }]}>
          Confirm the fiat arrived in your account before releasing. Verify payment after checking.
        </Text>
      ) : null}

      <View style={styles.grid}>
        <InfoCell label="Role" value={isBuyer ? 'Buyer' : 'Seller'} theme={theme} />
        <InfoCell label="Counterparty" value={counterparty} theme={theme} />
        <InfoCell label="Crypto" value={`${order.quantity} ${order.crypto_symbol ?? ''}`.trim()} theme={theme} />
        <InfoCell label="Fiat" value={`${sym}${order.fiat_amount ?? '—'} ${fiat}`} theme={theme} />
      </View>

      {!isBuyer && order.status === 'payment_confirmed' && order.transaction_reference ? (
        <View style={[styles.block, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
          <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 4 }}>
            Buyer Transaction Reference
          </Text>
          <Text style={{ fontSize: 14, color: `hsl(${theme.colors.foregroundPrimary})` }}>{order.transaction_reference}</Text>
        </View>
      ) : null}

      {!isBuyer && order.status === 'payment_confirmed' && order.payment_proof_url ? (
        <View style={[styles.block, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
          <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 8 }}>
            Payment Proof
          </Text>
          <PaymentProofViewer orderId={order.id} paymentProofUrl={order.payment_proof_url} />
        </View>
      ) : null}
    </View>
  );
}

export function OrderRoomHeader({
  orderId,
  onCopy,
  copied,
}: {
  orderId: string;
  onCopy: () => void;
  copied: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onCopy();
      }}
      style={styles.idRow}
    >
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>Order ID</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: undefined, fontWeight: '600', color: `hsl(${theme.colors.foregroundPrimary})` }}>
          #{orderId.slice(0, 12)}
        </Text>
        <Ionicons
          name={copied ? 'checkmark-circle' : 'copy-outline'}
          size={16}
          color={copied ? `hsl(${theme.colors.tradeBuy})` : `hsl(${theme.colors.foregroundSecondary})`}
        />
      </View>
    </Pressable>
  );
}

export async function copyOrderId(orderId: string): Promise<void> {
  await Clipboard.setStringAsync(orderId);
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  hint: {
    marginHorizontal: 14,
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 6 },
  cell: { width: '50%', padding: 8 },
  block: { marginHorizontal: 14, marginBottom: 12, padding: 10, borderRadius: 8, borderWidth: 1 },
  proofWrap: { gap: 8 },
  proofImage: { width: '100%', height: 180, borderRadius: 8 },
  idRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
});
