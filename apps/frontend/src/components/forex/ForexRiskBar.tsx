'use client';

import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';
import { cn } from '@/lib/utils';
import { fxNum, fxPlain } from './format';

export function ForexRiskBar() {
  const risk = useForexStore((s) => s.riskStatus);
  const margin = useForexStore((s) => s.margin);
  const exposure = useForexStore((s) => s.exposure);
  const authed = hasForexPrivateSession();
  if (!authed) return null;

  const state = risk?.state ?? '—';
  const exp =
    (typeof exposure?.accountNet === 'string' && exposure.accountNet) ||
    (typeof exposure?.net === 'string' && exposure.net) ||
    margin?.netExposure;

  return (
    <div
      className="flex h-7 shrink-0 items-center gap-3 overflow-x-auto border-t border-stone-200 bg-stone-50 px-3 font-mono text-[10px] dark:border-stone-800 dark:bg-[#121416]"
      aria-label="Risk bar"
    >
      <span
        className={cn(
          'rounded px-1.5 py-0.5 font-medium',
          state === 'NORMAL' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
          (state === 'WARNING' || state === 'RESTRICTED') && 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
          (state === 'LIQUIDATION_ONLY' || state === 'HALTED') && 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
          state === '—' && 'text-stone-500'
        )}
      >
        {state}
        {risk?.reason ? ` · ${risk.reason}` : ''}
      </span>
      <span className="text-stone-500">Margin {margin?.status ?? '—'}</span>
      <span>Exposure {fxPlain(exp)}</span>
      <span>Maint {fxNum(margin?.maintenanceMargin, 2)}</span>
      {risk?.liquidationLock ? <span className="text-rose-700">Liquidation lock</span> : null}
    </div>
  );
}
