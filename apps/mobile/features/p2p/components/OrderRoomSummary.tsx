import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard, StatusChip } from '@shared/ui';
import { useTheme, hapticLight } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import type { StatusChipTone } from '@shared/theme/statusPalettes';
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

function orderStatusChipTone(status: string): StatusChipTone {
  switch (status) {
    case 'payment_pending':
      return 'warn';
    case 'payment_confirmed':
      return 'sync';
    case 'completed':
    case 'released':
      return 'live';
    case 'disputed':
      return 'off';
    default:
      return 'neutral';
  }
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
      <View style={{ gap: theme.spacing[2] }}>
        <Pressable onPress={() => void loadSecure()} disabled={loading}>
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            {loading ? 'Loading…' : uri ? 'Reload proof' : 'View payment proof'}
          </Text>
        </Pressable>
        {err ? (
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.statusError})` }]}>{err}</Text>
        ) : null}
        {loading ? <ActivityIndicator style={{ marginTop: theme.spacing[2] }} /> : null}
        {uri ? (
          <Image
            source={{ uri }}
            style={[styles.proofImage, { borderRadius: theme.radius.md }]}
            resizeMode="contain"
          />
        ) : null}
      </View>
    );
  }

  const href = paymentProofUrl.startsWith('http') ? paymentProofUrl : paymentProofUrl;
  return (
    <Image
      source={{ uri: href }}
      style={[styles.proofImage, { borderRadius: theme.radius.md }]}
      resizeMode="contain"
    />
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.cell, { padding: theme.spacing[2] }]}>
      <Text
        style={[
          theme.typography.labelSm,
          { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[1] },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          theme.typography.bodyMd,
          { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function OrderRoomSummary({ order, isBuyer }: Props) {
  const { theme } = useTheme();
  const fiat = order.fiat_currency ?? 'USD';
  const sym = formatFiatSymbol(fiat);
  const vBadge = verificationBadgeLabel(order.payment_verification_status);
  const counterparty = isBuyer ? order.seller_username ?? '—' : order.buyer_username ?? '—';
  const warning = semanticStatusPalette(theme.colors, 'warning');

  return (
    <ExchangeCard padded={false} style={{ overflow: 'hidden', marginBottom: theme.spacing[3] }}>
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: theme.spacing[3.5],
            paddingVertical: theme.spacing[3],
            borderBottomColor: `hsl(${theme.colors.borderDefault})`,
            gap: theme.spacing[2],
          },
        ]}
      >
        <Text
          style={[
            theme.typography.headingSm,
            { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
          ]}
        >
          Order Details
        </Text>
        <View style={[styles.badges, { gap: theme.spacing[1.5] }]}>
          <StatusChip label={orderStatusLabel(order.status)} tone={orderStatusChipTone(order.status)} />
          {vBadge ? <StatusChip label={vBadge.label} tone="warn" /> : null}
        </View>
      </View>

      {!isBuyer && order.status === 'payment_confirmed' && order.payment_verification_status === 'pending' ? (
        <Text
          style={[
            theme.typography.bodySm,
            styles.hint,
            {
              color: warning.fg,
              borderColor: warning.border,
              backgroundColor: warning.bg,
              marginHorizontal: theme.spacing[3.5],
              marginTop: theme.spacing[3],
              padding: theme.spacing[2.5],
              borderRadius: theme.radius.md,
            },
          ]}
        >
          Confirm the fiat arrived in your account before releasing. Verify payment after checking.
        </Text>
      ) : null}

      <View style={[styles.grid, { padding: theme.spacing[1.5] }]}>
        <InfoCell label="Role" value={isBuyer ? 'Buyer' : 'Seller'} />
        <InfoCell label="Counterparty" value={counterparty} />
        <InfoCell label="Crypto" value={`${order.quantity} ${order.crypto_symbol ?? ''}`.trim()} />
        <InfoCell label="Fiat" value={`${sym}${order.fiat_amount ?? '—'} ${fiat}`} />
      </View>

      {!isBuyer && order.status === 'payment_confirmed' && order.transaction_reference ? (
        <View
          style={[
            styles.block,
            {
              borderColor: `hsl(${theme.colors.borderDefault})`,
              marginHorizontal: theme.spacing[3.5],
              marginBottom: theme.spacing[3],
              padding: theme.spacing[2.5],
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.labelSm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[1] },
            ]}
          >
            Buyer Transaction Reference
          </Text>
          <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            {order.transaction_reference}
          </Text>
        </View>
      ) : null}

      {!isBuyer && order.status === 'payment_confirmed' && order.payment_proof_url ? (
        <View
          style={[
            styles.block,
            {
              borderColor: `hsl(${theme.colors.borderDefault})`,
              marginHorizontal: theme.spacing[3.5],
              marginBottom: theme.spacing[3],
              padding: theme.spacing[2.5],
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.labelSm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[2] },
            ]}
          >
            Payment Proof
          </Text>
          <PaymentProofViewer orderId={order.id} paymentProofUrl={order.payment_proof_url} />
        </View>
      ) : null}
    </ExchangeCard>
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
  const success = semanticStatusPalette(theme.colors, 'success');
  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onCopy();
      }}
      style={[styles.idRow, { marginBottom: theme.spacing[2] }]}
    >
      <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Order ID</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1.5] }}>
        <Text
          style={[
            theme.typography.bodySm,
            { fontFamily: theme.fonts.monoSemiBold, color: `hsl(${theme.colors.foregroundPrimary})` },
          ]}
        >
          #{orderId.slice(0, 12)}
        </Text>
        <Ionicons
          name={copied ? 'checkmark-circle' : 'copy-outline'}
          size={theme.sizes.iconSm}
          color={copied ? success.fg : `hsl(${theme.colors.foregroundSecondary})`}
        />
      </View>
    </Pressable>
  );
}

export async function copyOrderId(orderId: string): Promise<void> {
  await Clipboard.setStringAsync(orderId);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    flexWrap: 'wrap',
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%' },
  block: { borderWidth: 1 },
  proofImage: { width: '100%', height: 180 },
  idRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
