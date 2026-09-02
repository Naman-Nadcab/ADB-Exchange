'use client';

import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';
import { cn } from '@/lib/utils';
import { fxNum, fxPlain } from './format';

export function ForexRiskBar() {
  const risk = useForexStore((s) => s.riskStatus);
  const margin = useForexStore((s) => s.margin);
  const exposure = useForexStore((s) => s.exposure);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const authed = hasForexPrivateSession();
  if (!authed) return null;

  if ((hydratePhase === 'idle' || hydratePhase === 'hydrating') && !risk && !margin) {
    return (
      <div className="flex h-7 shrink-0 items-center border-t border-border bg-muted/40 px-3 text-[10px] text-muted-foreground" role="status">
        Loading risk…
      </div>
    );
  }

  const state = risk?.state;
  const exp =
    (typeof exposure?.accountNet === 'string' && exposure.accountNet) ||
    (typeof exposure?.net === 'string' && exposure.net) ||
    margin?.netExposure;

  return (
    <div
      className="flex h-7 shrink-0 items-center gap-3 overflow-x-auto border-t border-border bg-muted/40 px-3 font-mono text-[10px] tabular-nums"
      aria-label="Risk bar"
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
        {state ?? 'Unavailable'}
        {risk?.reason ? ` · ${risk.reason}` : ''}
      </span>
      <span className="text-muted-foreground">Margin {margin?.status ?? 'Unavailable'}</span>
      <span>Exposure {fxPlain(exp)}</span>
      <span>Maint {fxNum(margin?.maintenanceMargin, 2)}</span>
      {risk?.liquidationLock ? <span className="text-sell">Liquidation lock</span> : null}
    </div>
  );
}
