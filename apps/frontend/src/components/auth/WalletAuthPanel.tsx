'use client';

import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { COOKIE_SESSION_MARKER } from '@/lib/authSession';
import {
  connectWallet,
  currentWalletAccount,
  discoverWallets,
  signWalletMessage,
  watchWallet,
  type DiscoveredWallet,
} from '@/lib/wallet-auth/browser-connector';
import { walletChallenge, walletVerify } from '@/lib/wallet-auth/api';
import { runWalletAuthentication, type WalletAuthFailureCode, type WalletAuthPhase } from '@/lib/wallet-auth/flow';
import { mobileWalletHandoffs, type MobileWalletHandoff } from '@/lib/wallet-auth/mobile-wallet-handoff';
import { WalletChoiceRow } from '@/components/auth/WalletChoiceRow';

type Props = {
  actionLabel: string;
  disabled?: boolean;
  onSuccess: (user: Record<string, unknown>, accessToken: string, refreshToken: string) => void;
};

const BUSY = new Set<WalletAuthPhase>(['connecting', 'challenging', 'signing', 'verifying']);

export function WalletAuthPanel({ actionLabel, disabled, onSuccess }: Props) {
  const t = useTranslations('auth.wallet');
  const [open, setOpen] = useState(false);
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [handoffs, setHandoffs] = useState<MobileWalletHandoff[]>([]);
  const [phase, setPhase] = useState<WalletAuthPhase>('idle');
  const [error, setError] = useState('');
  const running = useRef(false);

  const busy = BUSY.has(phase);

  const messageFor = (code: WalletAuthFailureCode): string => {
    if (code === 'USER_REJECTED') return t('rejected');
    if (code === 'WALLET_DISCONNECTED') return t('disconnected');
    if (code === 'CHALLENGE_EXPIRED') return t('expired');
    if (code === 'CHALLENGE_USED') return t('used');
    if (code === 'RATE_LIMITED') return t('rateLimit');
    if (code === 'NETWORK') return t('network');
    return t('failed');
  };

  const phaseLabel = (): string => {
    if (phase === 'connecting') return t('connecting');
    if (phase === 'signing') return t('signing');
    if (phase === 'challenging' || phase === 'verifying') return t('verifying');
    return '';
  };

  const openPicker = () => {
    if (disabled || busy || running.current) return;
    setError('');
    setPhase('idle');
    const found = discoverWallets();
    setWallets(found);
    setHandoffs(found.length === 0 ? mobileWalletHandoffs(navigator.userAgent, window.location.href) : []);
    setOpen(true);
  };

  const start = async (wallet: DiscoveredWallet) => {
    if (running.current) return;
    running.current = true;
    setError('');
    let restarts = 0;
    try {
      while (restarts < 3) {
        const result = await runWalletAuthentication({
          connect: () => connectWallet(wallet.id),
          getAccount: () => currentWalletAccount(),
          signMessage: (message) => signWalletMessage(message),
          watch: (onChange) => watchWallet(onChange),
          requestChallenge: async (caip10) => {
            const challenge = await walletChallenge(caip10);
            return { id: challenge.id, message: challenge.message };
          },
          verify: (body) => walletVerify(body),
          onPhase: setPhase,
        });
        if (result.ok) {
          setPhase('authenticated');
          setOpen(false);
          onSuccess(
            result.user,
            result.accessToken || COOKIE_SESSION_MARKER,
            result.refreshToken || COOKIE_SESSION_MARKER,
          );
          return;
        }
        if (result.restart) {
          restarts += 1;
          setError(result.reason === 'chain' ? t('chainChanged') : t('accountChanged'));
          continue;
        }
        setPhase('idle');
        setError(messageFor(result.code));
        return;
      }
      setPhase('idle');
      setError(t('failed'));
    } finally {
      running.current = false;
    }
  };

  const status = phaseLabel();

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled || busy}
        aria-busy={busy}
        className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {busy ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
            {status || actionLabel}
          </span>
        ) : actionLabel}
      </button>
      <p className="text-sm text-muted-foreground">{t('security')}</p>
      {error && !open && (
        <p className="text-destructive text-sm rounded-lg bg-destructive/10 px-3 py-2" role="alert">{error}</p>
      )}

      <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
        <DialogContent className="max-h-[min(36rem,calc(100dvh-1.5rem))] max-w-md overflow-y-auto rounded-2xl border-primary/20 bg-card p-5 shadow-2xl sm:p-6" aria-busy={busy}>
          <DialogHeader className="text-left">
            <DialogTitle className="text-foreground">{t('choose')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">{t('security')}</DialogDescription>
          </DialogHeader>
          <p className="sr-only" aria-live="polite">{status || error}</p>
          {status && (
            <p className="text-sm text-foreground inline-flex items-center gap-2" role="status">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              {status}
            </p>
          )}
          {error && <p className="text-destructive text-sm rounded-lg bg-destructive/10 px-3 py-2" role="alert">{error}</p>}
          {wallets.length === 0 && handoffs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">{t('none')}</p>
          ) : wallets.length === 0 ? (
            <div className="space-y-2.5">
              <p className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs leading-relaxed text-foreground">{t('mobileHint')}</p>
              <ul className="space-y-2">
                {handoffs.map((wallet) => (
                  <li key={wallet.id}>
                    <WalletChoiceRow
                      name={wallet.name}
                      namespace={wallet.namespace}
                      networkLabel={wallet.namespace === 'solana' ? t('networkSolana') : t('networkEvm')}
                      href={wallet.href}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="space-y-2">
              {wallets.map((wallet) => (
                <li key={wallet.id}>
                  <WalletChoiceRow
                    name={wallet.name}
                    namespace={wallet.namespace}
                    networkLabel={wallet.namespace === 'solana' ? t('networkSolana') : t('networkEvm')}
                    disabled={busy}
                    onClick={() => { void start(wallet); }}
                  />
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen(false)}
            className="w-full rounded-xl border border-border bg-background py-3 text-sm font-medium text-foreground hover:bg-accent/50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('close')}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
