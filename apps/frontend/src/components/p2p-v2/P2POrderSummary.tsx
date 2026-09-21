'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { P2POrderRow } from '@/lib/p2pApi';
import { formatFiatSymbol } from '@/lib/p2p-v2-utils';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { useAuthStore } from '@/store/auth';
import { Loader2 } from 'lucide-react';
import { CoinIcon } from '@/components/ui/CoinIcon';

/* ── Helpers ── */
function statusLabel(s: string, tp: (key: string) => string): string {
  const key = `orderStatus.${s}` as const;
  if (['payment_pending', 'payment_confirmed', 'completed', 'cancelled', 'expired', 'disputed'].includes(s)) {
    return tp(key);
  }
  return s;
}

const STATUS_CLS: Record<string, string> = {
  payment_pending: 'bg-amber-500/10 text-amber-500',
  payment_confirmed: 'bg-blue-500/10 text-blue-500',
  completed: 'bg-[#0ecb81]/10 text-[#0ecb81]',
  cancelled: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
  disputed: 'bg-[#f6465d]/10 text-[#f6465d]',
};

function verificationBadge(
  pvs: string | null | undefined,
  tp: (key: string) => string
): { label: string; cls: string } | null {
  if (pvs == null || pvs === '') return null;
  switch (pvs) {
    case 'pending': return { label: tp('orderVerification.pending'), cls: 'bg-amber-500/10 text-amber-500' };
    case 'verified': return { label: tp('orderVerification.verified'), cls: 'bg-[#0ecb81]/10 text-[#0ecb81]' };
    case 'rejected': return { label: tp('orderVerification.rejected'), cls: 'bg-[#f6465d]/10 text-[#f6465d]' };
    default: return { label: String(pvs), cls: 'bg-muted text-muted-foreground' };
  }
}

/* ── Payment proof viewer (logic unchanged) ── */
function PaymentProofViewer({ orderId, paymentProofUrl }: { orderId: string; paymentProofUrl: string }) {
  const tp = useTranslations('p2p');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);

  const isSecure = paymentProofUrl.startsWith('secure:');
  const legacyHref =
    typeof window !== 'undefined' && paymentProofUrl.startsWith('/assets/')
      ? `${window.location.origin}${paymentProofUrl}`
      : paymentProofUrl;

  const loadSecure = async () => {
    if (!accessToken) { setErr(tp('orderSummary.notSignedIn')); return; }
    setLoading(true);
    setErr(null);
    try {
      const base = getApiBaseUrl();
      const res = await fetch(
        `${base}/api/v1/p2p/orders/${encodeURIComponent(orderId)}/payment-proof`,
        { headers: { Authorization: `Bearer ${accessToken}` }, credentials: 'include' },
      );
      if (!res.ok) throw new Error((await res.text()) || res.statusText);
      const b = await res.blob();
      const u = URL.createObjectURL(b);
      setBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return u; });
    } catch (e) {
      setErr(e instanceof Error ? e.message : tp('orderSummary.proofLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  if (isSecure) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void loadSecure()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {blobUrl ? tp('orderSummary.reloadProof') : tp('orderSummary.viewProof')}
        </button>
        {err && <p className="text-xs text-[#f6465d]">{err}</p>}
        {blobUrl && <img src={blobUrl} alt={tp('orderSummary.proofAlt')} className="max-h-48 max-w-full rounded-lg border border-border/30" />}
      </div>
    );
  }

  return (
    <a href={legacyHref} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
      {tp('orderSummary.openImage')}
    </a>
  );
}

/* ── Main component ── */
type Props = { order: P2POrderRow; isBuyer: boolean };

export function P2POrderSummary({ order, isBuyer }: Props) {
  const tp = useTranslations('p2p');
  const tf = useTranslations('p2p.orderSummaryFields');
  const fiat = order.fiat_currency ?? 'USD';
  const sym = formatFiatSymbol(fiat);
  const vBadge = verificationBadge(order.payment_verification_status, tp);
  const isSeller = !isBuyer;
  const sCls = STATUS_CLS[order.status] ?? 'bg-muted text-muted-foreground';

  return (
    <div className="rounded-lg border border-border/30 bg-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/20 px-4 py-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{tp('orderSummary.title')}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${sCls}`}>
            {statusLabel(order.status, tp)}
          </span>
          {vBadge && (
            <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${vBadge.cls}`}>{vBadge.label}</span>
          )}
        </div>
      </div>

      {isSeller && order.status === 'payment_confirmed' && order.payment_verification_status === 'pending' && (
        <p className="mx-4 mt-3 rounded-md border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-sm text-amber-500">
          {tf('sellerVerifyHint')}
        </p>
      )}

      {/* Info grid */}
      <div className="m-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border/10 p-px">
        <div className="bg-card p-3.5">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{tf('role')}</p>
          <p className="text-sm font-semibold text-foreground">{isBuyer ? tf('buyer') : tf('seller')}</p>
        </div>
        <div className="bg-card p-3.5">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{tf('counterparty')}</p>
          <p className="truncate text-sm font-medium text-foreground">
            {isBuyer ? order.seller_username ?? '—' : order.buyer_username ?? '—'}
          </p>
        </div>
        <div className="bg-card p-3.5">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{tf('crypto')}</p>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {order.crypto_symbol && <CoinIcon symbol={order.crypto_symbol} size={18} />}
            <span className="numeric">{order.quantity}</span> {order.crypto_symbol ?? ''}
          </p>
        </div>
        <div className="bg-card p-3.5">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{tf('fiat')}</p>
          <p className="numeric text-sm font-semibold text-foreground">
            {sym}{order.fiat_amount ?? '—'} {fiat}
          </p>
        </div>
      </div>

      {/* Transaction reference & proof */}
      {!isBuyer && order.status === 'payment_confirmed' && order.transaction_reference && (
        <div className="mx-4 mb-3 rounded-md bg-muted/10 border border-border/15 px-3 py-2.5">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{tf('buyerTxRef')}</p>
          <p className="numeric break-all text-sm text-foreground">{order.transaction_reference}</p>
        </div>
      )}
      {!isBuyer && order.status === 'payment_confirmed' && order.payment_proof_url && (
        <div className="mx-4 mb-3 rounded-md bg-muted/10 border border-border/15 px-3 py-2.5">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{tf('paymentProof')}</p>
          <PaymentProofViewer orderId={order.id} paymentProofUrl={order.payment_proof_url} />
        </div>
      )}
    </div>
  );
}
