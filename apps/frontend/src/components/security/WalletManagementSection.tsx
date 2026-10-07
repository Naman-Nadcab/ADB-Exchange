'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  connectWallet,
  currentWalletAccount,
  discoverWallets,
  disconnectWallet,
  signWalletMessage,
  signWalletTypedData,
  type DiscoveredWallet,
} from '@/lib/wallet-auth/browser-connector';
import { sameWalletAddress, shortAddress } from '@/lib/wallet-auth/display';
import { mobileWalletHandoffs, type MobileWalletHandoff } from '@/lib/wallet-auth/mobile-wallet-handoff';
import { WalletChoiceRow } from '@/components/auth/WalletChoiceRow';
import {
  listManagedWallets,
  requestLinkChallenge,
  requestStepUp,
  submitWalletAction,
  verifyLinkChallenge,
  WalletManagementApiError,
  type ManagedWallet,
} from '@/lib/wallet-auth/management-api';

type Props = {
  accessToken: string | null;
};

type DialogMode = 'add' | 'primary' | 'unlink' | null;

function formatWhen(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

export function WalletManagementSection({ accessToken }: Props) {
  const t = useTranslations('account');
  const [wallets, setWallets] = useState<ManagedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [mode, setMode] = useState<DialogMode>(null);
  const [target, setTarget] = useState<ManagedWallet | null>(null);
  const [choices, setChoices] = useState<DiscoveredWallet[]>([]);
  const [handoffs, setHandoffs] = useState<MobileWalletHandoff[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listManagedWallets(accessToken);
      setWallets(rows);
      setError('');
    } catch (err) {
      setError(listError(t, err));
    } finally {
      setLoading(false);
    }
  }, [accessToken, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const messageFor = (code: string): string => {
    if (code === 'ALREADY_LINKED') return t('security.wallets.alreadyLinked');
    if (code === 'WALLET_UNAVAILABLE') return t('security.wallets.unavailable');
    if (code === 'LAST_FACTOR') return t('security.wallets.lastFactor');
    if (code === 'PRIMARY_REPLACEMENT_REQUIRED') return t('security.wallets.primaryRequired');
    if (code === 'USER_REJECTED' || code === 'BAD_SIGNATURE') return t('security.wallets.rejected');
    if (code === 'CHALLENGE_EXPIRED') return t('security.wallets.expired');
    if (code === 'RATE_LIMIT_EXCEEDED') return t('security.wallets.rateLimit');
    if (code === 'NETWORK') return t('security.wallets.network');
    if (code === 'ADDRESS_MISMATCH') return t('security.wallets.mismatch');
    return t('security.wallets.failed');
  };

  const fail = (err: unknown) => {
    const code = err instanceof WalletManagementApiError
      ? err.code
      : err instanceof Error
        ? err.message
        : 'FAILED';
    const rejected = code === '4001' || /reject/i.test(code);
    setError(messageFor(rejected ? 'USER_REJECTED' : code));
  };

  const openAdd = () => {
    if (busy) return;
    setError('');
    setNotice('');
    setTarget(null);
    const found = discoverWallets();
    setChoices(found);
    setHandoffs(found.length === 0 ? mobileWalletHandoffs(navigator.userAgent, window.location.href) : []);
    setMode('add');
  };

  const openSensitive = (next: 'primary' | 'unlink', wallet: ManagedWallet) => {
    if (busy) return;
    setError('');
    setNotice('');
    setTarget(wallet);
    setChoices(discoverWallets());
    setHandoffs([]);
    setMode(next);
  };

  const close = () => {
    if (busy) return;
    setMode(null);
    setTarget(null);
  };

  const copyAddress = async (wallet: ManagedWallet) => {
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopiedId(wallet.id);
      window.setTimeout(() => setCopiedId(''), 2000);
    } catch {
      setError(t('security.wallets.failed'));
    }
  };

  const signChallenge = async (message: string, signing: 'personal' | 'typed_data') => {
    if (signing === 'typed_data') return signWalletTypedData(message);
    return signWalletMessage(message);
  };

  const runAdd = async (choice: DiscoveredWallet) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const account = await connectWallet(choice.id);
      const caip10 = `${account.namespace}:${account.chainReference}:${account.address}`;
      const challenge = await requestLinkChallenge(accessToken, caip10, choice.name);
      const current = await currentWalletAccount();
      if (!sameWalletAddress(account.namespace, current.address, account.address)) {
        throw new Error('ADDRESS_MISMATCH');
      }
      const signature = await signChallenge(challenge.message, challenge.signing);
      await verifyLinkChallenge(accessToken, {
        challengeId: challenge.id,
        message: challenge.message,
        signature,
      });
      setNotice(t('security.wallets.successLinked'));
      setMode(null);
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
      await disconnectWallet().catch(() => {});
    }
  };

  const runSensitive = async (choice: DiscoveredWallet) => {
    if (busy || !target || (mode !== 'primary' && mode !== 'unlink')) return;
    setBusy(true);
    setError('');
    try {
      const account = await connectWallet(choice.id);
      if (account.namespace !== target.namespace || !sameWalletAddress(target.namespace, account.address, target.address)) {
        throw new Error('ADDRESS_MISMATCH');
      }
      const action = mode === 'primary' ? 'set_primary_wallet' : 'unlink_wallet';
      const challenge = await requestStepUp(accessToken, target.id, action);
      const current = await currentWalletAccount();
      if (!sameWalletAddress(target.namespace, current.address, target.address)) {
        throw new Error('ADDRESS_MISMATCH');
      }
      const signature = await signChallenge(challenge.message, challenge.signing);
      await submitWalletAction(accessToken, target.id, mode === 'primary' ? 'primary' : 'unlink', {
        challengeId: challenge.id,
        message: challenge.message,
        signature,
      });
      setNotice(mode === 'primary' ? t('security.wallets.successPrimary') : t('security.wallets.successRemoved'));
      setMode(null);
      setTarget(null);
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
      await disconnectWallet().catch(() => {});
    }
  };

  const statusLabel = (status: string) => {
    if (status === 'active') return t('security.wallets.statusActive');
    if (status === 'disabled') return t('security.wallets.statusDisabled');
    return t('security.wallets.statusCompromised');
  };

  const chainLabel = (wallet: ManagedWallet) => (
    wallet.namespace === 'solana'
      ? `${t('security.wallets.namespaceSolana')} · ${wallet.chainReference}`
      : `${t('security.wallets.namespaceEvm')} · ${wallet.chainReference}`
  );

  const confirmText = target
    ? mode === 'unlink'
      ? t('security.wallets.confirmRemove', { address: shortAddress(target.address) })
      : t('security.wallets.confirmPrimary', { address: shortAddress(target.address) })
    : '';

  return (
    <section className="mb-8" aria-labelledby="sign-in-wallets-heading" data-testid="wallet-management">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="sign-in-wallets-heading" className="text-lg font-semibold text-foreground">
            {t('security.wallets.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('security.wallets.description')}</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          disabled={busy}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/85 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          data-testid="add-wallet"
        >
          {t('security.wallets.add')}
        </button>
      </div>

      {notice && <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-foreground" role="status">{notice}</p>}
      {error && <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('security.wallets.loading')}
        </div>
      ) : wallets.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('security.wallets.empty')}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {wallets.map((wallet) => {
            const active = wallet.status === 'active';
            return (
              <li key={wallet.id} className="rounded-xl border border-border bg-card p-5 shadow-sm" data-testid="wallet-row">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                    <Wallet className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground" title={wallet.address}>
                        {shortAddress(wallet.address)}
                      </p>
                      <button
                        type="button"
                        onClick={() => { void copyAddress(wallet); }}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={t('security.wallets.copy')}
                      >
                        <Copy className="h-4 w-4" aria-hidden />
                      </button>
                      {wallet.isPrimary && active && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                          {t('security.wallets.primary')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {chainLabel(wallet)}
                      {wallet.provider ? ` · ${wallet.provider}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${active ? 'bg-buy' : 'bg-muted-foreground'}`} aria-hidden />
                      {statusLabel(wallet.status)}
                      {' · '}
                      {t('security.wallets.linked')} {formatWhen(wallet.linkedAt)}
                      {' · '}
                      {t('security.wallets.lastUsed')} {formatWhen(wallet.lastUsedAt)}
                    </p>
                  </div>
                </div>
                {active && (
                  <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-border pt-4">
                    {!wallet.isPrimary && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openSensitive('primary', wallet)}
                        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/85 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        data-testid="set-primary"
                      >
                        {t('security.wallets.setPrimary')}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openSensitive('unlink', wallet)}
                      className="rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      data-testid="unlink-wallet"
                    >
                      {t('security.wallets.remove')}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={mode != null} onOpenChange={(next) => { if (!next) close(); }}>
        <DialogContent className="max-w-md rounded-xl border-border bg-card p-6" aria-busy={busy}>
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {mode === 'add' ? t('security.wallets.add') : mode === 'unlink' ? t('security.wallets.remove') : t('security.wallets.setPrimary')}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {mode === 'add' ? t('security.wallets.description') : confirmText}
            </DialogDescription>
          </DialogHeader>
          {mode === 'unlink' && (
            <p className="text-sm text-muted-foreground">{t('security.wallets.fundsNote')}</p>
          )}
          {busy && (
            <p className="inline-flex items-center gap-2 text-sm text-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('security.wallets.signing')}
            </p>
          )}
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
          {choices.length === 0 && handoffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('security.wallets.noWallets')}</p>
          ) : choices.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('auth.wallet.mobileHint')}</p>
              <ul className="space-y-2">
                {handoffs.map((wallet) => (
                  <li key={wallet.id}>
                    <WalletChoiceRow
                      name={wallet.name}
                      namespace={wallet.namespace}
                      networkLabel={wallet.namespace === 'solana' ? t('auth.wallet.networkSolana') : t('auth.wallet.networkEvm')}
                      href={wallet.href}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="space-y-2">
              {choices.map((choice) => (
                <li key={choice.id}>
                  <WalletChoiceRow
                    name={choice.name}
                    namespace={choice.namespace}
                    networkLabel={choice.namespace === 'solana' ? t('auth.wallet.networkSolana') : t('auth.wallet.networkEvm')}
                    disabled={busy}
                    onClick={() => { void (mode === 'add' ? runAdd(choice) : runSensitive(choice)); }}
                  />
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={close}
            className="w-full rounded-xl border border-border py-3 font-medium text-foreground hover:bg-accent/50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('security.wallets.cancel')}
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function listError(t: ReturnType<typeof useTranslations>, err: unknown): string {
  const code = err instanceof WalletManagementApiError ? err.code : '';
  if (code === 'RATE_LIMIT_EXCEEDED') return t('security.wallets.rateLimit');
  if (code === 'NETWORK') return t('security.wallets.network');
  return t('security.wallets.failed');
}
