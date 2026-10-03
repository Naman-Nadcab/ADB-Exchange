'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  cancelWalletRecovery,
  getWalletRecovery,
  requestWalletRecovery,
  WalletRecoveryApiError,
  type RecoveryView,
} from '@/lib/wallet-auth/recovery-api';

type Props = {
  accessToken: string | null;
};

function factorLabel(on: boolean, yes: string, no: string): string {
  return on ? yes : no;
}

export function WalletRecoverySection({ accessToken }: Props) {
  const t = useTranslations('account');
  const [recovery, setRecovery] = useState<RecoveryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRecovery(await getWalletRecovery(accessToken));
      setError('');
    } catch (err) {
      const code = err instanceof WalletRecoveryApiError ? err.code : 'FAILED';
      setError(code === 'NETWORK' ? t('security.recovery.network') : t('security.recovery.failed'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const factors = recovery?.factors;
  const status = recovery?.status ?? t('security.recovery.none');
  const openCase = recovery && !['COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(recovery.status);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await requestWalletRecovery(accessToken);
      setRecovery(next);
      setNotice(t('security.recovery.requested'));
      setOpen(false);
    } catch (err) {
      const code = err instanceof WalletRecoveryApiError ? err.code : 'FAILED';
      if (code === 'EMAIL_NOT_SUFFICIENT') setError(t('security.recovery.emailBlocked'));
      else if (code === 'RECOVERY_OPEN') setError(t('security.recovery.alreadyOpen'));
      else if (code === 'NETWORK') setError(t('security.recovery.network'));
      else setError(t('security.recovery.failed'));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await cancelWalletRecovery(accessToken);
      setNotice(t('security.recovery.cancelled'));
      await refresh();
    } catch (err) {
      const code = err instanceof WalletRecoveryApiError ? err.code : 'FAILED';
      setError(code === 'NETWORK' ? t('security.recovery.network') : t('security.recovery.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-8" aria-labelledby="wallet-recovery-heading" data-testid="wallet-recovery">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="wallet-recovery-heading" className="text-lg font-semibold text-foreground">
            {t('security.recovery.title')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('security.recovery.description')}</p>
        </div>
        <button
          type="button"
          onClick={() => { setError(''); setOpen(true); }}
          disabled={busy || Boolean(openCase)}
          className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          data-testid="lost-wallet"
        >
          {t('security.recovery.lostWallet')}
        </button>
      </div>

      {notice && <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-foreground" role="status">{notice}</p>}
      {error && <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('security.recovery.loading')}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" aria-hidden />
              <h3 className="text-sm font-semibold text-foreground">{t('security.recovery.factors')}</h3>
            </div>
            <ul className="space-y-2 text-sm text-foreground">
              <li>{t('security.recovery.wallets')}: {factors?.activeWalletCount ?? 0}</li>
              <li>{t('security.recovery.passkey')}: {factorLabel(Boolean(factors && factors.passkeyCount > 0), t('security.recovery.available'), t('security.recovery.notSet'))}</li>
              <li>{t('security.recovery.totp')}: {factorLabel(Boolean(factors?.totpEnabled), t('security.recovery.available'), t('security.recovery.notSet'))}</li>
              <li>{t('security.recovery.emailNote')}</li>
            </ul>
            {factors && factors.activeWalletCount <= 1 && factors.passkeyCount === 0 && !factors.totpEnabled && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300" role="status" data-testid="sole-wallet-warning">
                {t('security.recovery.soleFactorWarning')}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4" data-testid="recovery-status">
            <h3 className="mb-2 text-sm font-semibold text-foreground">{t('security.recovery.status')}</h3>
            <p className="text-sm text-foreground">
              <span className="mr-2 inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-medium">{status}</span>
              {recovery?.withdrawalFrozen ? t('security.recovery.withdrawalsPaused') : t('security.recovery.withdrawalsNormal')}
            </p>
            {recovery?.cooldownUntil && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t('security.recovery.cooldownUntil')}: {new Date(recovery.cooldownUntil).toLocaleString()}
              </p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">{t('security.recovery.credentialNote')}</p>
            {openCase && (
              <button
                type="button"
                onClick={() => { void cancel(); }}
                disabled={busy || recovery?.status === 'COOLING_OFF'}
                className="mt-4 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t('security.recovery.cancel')}
              </button>
            )}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('security.recovery.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('security.recovery.dialogBody')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('security.recovery.close')}
            </button>
            <button
              type="button"
              onClick={() => { void start(); }}
              disabled={busy}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              data-testid="confirm-recovery"
            >
              {busy ? t('security.recovery.working') : t('security.recovery.confirm')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
