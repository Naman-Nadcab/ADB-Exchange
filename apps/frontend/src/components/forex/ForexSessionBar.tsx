'use client';

import { FOREX_SESSION_NAMES } from '@/lib/forex/models/types';
import { useForexStore } from '@/lib/forex/state/store';
import { cn } from '@/lib/utils';

export function ForexSessionBar() {
  const sessions = useForexStore((s) => s.sessions);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const eligibility = sessions?.eligibility;
  const active = new Set(eligibility?.sessions ?? []);
  const coverage = sessions?.holidayCoverage ?? eligibility?.holidayCoverage;
  const reason = eligibility?.reason;
  const connecting = !sessions && (hydratePhase === 'idle' || hydratePhase === 'hydrating');

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-200 bg-white px-3 py-1.5 text-[11px] dark:border-stone-800 dark:bg-[#121416]"
      aria-label="Forex sessions"
    >
      <span className="font-medium text-stone-500 dark:text-stone-400">Sessions</span>
      {connecting ? (
        <span className="font-mono text-stone-500" role="status">
          Connecting to market…
        </span>
      ) : null}
      {!connecting && FOREX_SESSION_NAMES.map((name) => {
        const isOpen = active.has(name);
        return (
          <span key={name} className="inline-flex items-center gap-1.5 font-mono">
            <span
              aria-hidden
              className={cn('h-1.5 w-1.5 rounded-full', isOpen ? 'bg-emerald-600' : 'bg-stone-300 dark:bg-stone-600')}
            />
            <span className={isOpen ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400'}>{name}</span>
            <span className="text-stone-400">{isOpen ? 'OPEN' : 'CLOSED'}</span>
          </span>
        );
      })}
      <span className="ml-auto font-mono text-stone-500">
        Market {eligibility?.open ? 'OPEN' : reason ?? '—'}
        {coverage ? ` · Holiday ${coverage}` : ''}
        {sessions?.dstApplied ? ' · DST IANA' : ''}
      </span>
    </div>
  );
}
