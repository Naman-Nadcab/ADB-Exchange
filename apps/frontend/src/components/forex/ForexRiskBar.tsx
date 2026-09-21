'use client';

import { useTranslations } from 'next-intl';
import { useForexPrivateSession } from '@/lib/forex/runtime/useForexSession';
import { useForexStore } from '@/lib/forex/state/store';
import { cn } from '@/lib/utils';
import { fxNum, fxPlain } from './format';

export function ForexRiskBar() {
  const tr = useTranslations('forex.riskBar');
  const trState = useTranslations('forex.riskStates');
  const account = useForexStore((s) => s.account);
  const risk = useForexStore((s) => s.riskStatus);
  const margin = useForexStore((s) => s.margin);
  const exposure = useForexStore((s) => s.exposure);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const authed = useForexPrivateSession();
  if (!authed) return null;

  if ((hydratePhase === 'idle' || hydratePhase === 'hydrating') && !risk && !margin) {
    return (
      <div className="flex h-7 shrink-0 items-center border-t border-border bg-muted/40 px-3 text-[10px] text-muted-foreground" role="status">
        {tr('loading')}
      </div>
    );
  }

  const state = risk?.state;
  const stateLabel = state ? trState(state) : trState('unavailable');
  const exp =
    (typeof exposure?.accountNet === 'string' && exposure.accountNet) ||
    (typeof exposure?.net === 'string' && exposure.net) ||
    margin?.netExposure;

  return (
    <div
      className="flex h-7 shrink-0 items-center gap-3 overflow-x-auto border-t border-border bg-muted/40 px-3 font-mono text-[10px] tabular-nums"
      aria-label={tr('ariaLabel')}
    >
      <span
        className={cn(
          'rounded px-1.5 py-0.5 font-medium',
          state === 'NORMAL' && 'bg-buy/15 text-buy',
          (state === 'WARNING' || state === 'RESTRICTED') && 'bg-primary/15 text-foreground',
          (state === 'LIQUIDATION_ONLY' || state === 'HALTED') && 'bg-sell/15 text-sell',
          !state && 'text-muted-foreground'
        )}
      >
        {stateLabel}
        {risk?.reason ? ` · ${risk.reason}` : ''}
      </span>
      <span className="text-muted-foreground">
        {tr('marginLabel')} {margin?.status ?? trState('unavailable')}
      </span>
      <span>
        {tr('level')} {account?.marginLevel ?? margin?.marginLevel ?? '—'}
      </span>
      <span>
        {tr('free')} {fxNum(account?.freeMargin ?? margin?.freeMargin, 2)}
      </span>
      <span>
        {tr('upnl')} {fxNum(account?.unrealizedPnl, 2)}
      </span>
      <span>
        {tr('exposure')} {fxPlain(exp)}
      </span>
      <span>
        {tr('maint')} {fxNum(margin?.maintenanceMargin, 2)}
      </span>
      {risk?.liquidationLock ? <span className="text-sell">{tr('liquidationLock')}</span> : null}
    </div>
  );
}
