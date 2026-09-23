'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { describeForexError } from '@/lib/forex/models/errors';
import { hydrateForexPrivate } from '@/lib/forex/runtime/hydrate';
import { useForexPrivateSession } from '@/lib/forex/runtime/useForexSession';
import { useForexStore } from '@/lib/forex/state/store';

const PENDING = new Set(['ACCEPTED', 'PENDING', 'NEW', 'TRIGGERING', 'VALIDATING', 'CANCEL_PENDING', 'WORKING', 'OPEN', 'PARTIAL']);

export function ForexPositionModeSwitch() {
  const t = useTranslations('forex.positionModeSwitch');
  const authed = useForexPrivateSession();
  const account = useForexStore((s) => s.account);
  const orders = useForexStore((s) => s.orders);
  const positionMap = useForexStore((s) => s.positions);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const mode = account?.positionMode ?? 'NETTING';
  const target = mode === 'NETTING' ? 'HEDGING' : 'NETTING';

  const blockers = useMemo(() => {
    const reasons: string[] = [];
    const openPos = Object.values(positionMap).filter((p) => p.status === 'OPEN');
    if (openPos.length > 0) reasons.push(t('blockerOpenPositions', { count: openPos.length }));
    const pending = Object.values(orders).filter((o) => PENDING.has(String(o.status ?? '').toUpperCase()));
    if (pending.length > 0) reasons.push(t('blockerPendingOrders', { count: pending.length }));
    return reasons;
  }, [positionMap, orders, t]);

  const canSwitch = blockers.length === 0;

  const submit = useCallback(async () => {
    if (!canSwitch) return;
    const ok = window.confirm(
      `${t('confirmTitle', { target })}\n\n` +
        (target === 'HEDGING' ? t('confirmHedging') : t('confirmNetting')) +
        `\n\n${t('confirmAudited')}`
    );
    if (!ok) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await forexApi.setPositionMode({ mode: target });
      const u = unwrap(res);
      if (!u.ok) {
        setNote(describeForexError(u.error));
        return;
      }
      await hydrateForexPrivate();
      setNote(t('success', { mode: u.data.positionMode }));
      setOpen(false);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t('failed'));
    } finally {
      setBusy(false);
    }
  }, [canSwitch, target, t]);

  if (!authed) return null;

  return (
    <>
      <button
        type="button"
        className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground hover:border-primary/40 hover:text-foreground"
        title={t('buttonTitle')}
        onClick={() => {
          setNote(null);
          setOpen(true);
        }}
      >
        {t('button')}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-label={t('dialogAria')}>
          <div className="max-w-md rounded-lg border border-border bg-card p-4 shadow-xl">
            <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{t('body', { mode, target })}</p>
            {blockers.length > 0 ? (
              <ul className="mt-2 list-disc pl-4 text-[11px] text-sell">
                {blockers.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-buy">{t('flatAllowed')}</p>
            )}
            {note ? <p className="mt-2 text-[11px] text-muted-foreground">{note}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded border border-border px-3 py-1 text-[11px]" onClick={() => setOpen(false)} disabled={busy}>
                {t('close')}
              </button>
              <button
                type="button"
                className="rounded bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
                disabled={!canSwitch || busy}
                onClick={() => void submit()}
              >
                {busy ? t('switching') : t('switchTo', { target })}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
