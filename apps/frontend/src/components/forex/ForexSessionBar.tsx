'use client';

import { FOREX_SESSION_NAMES } from '@/lib/forex/models/types';
import { useForexStore } from '@/lib/forex/state/store';
import { cn } from '@/lib/utils';

export function ForexSessionBar() {
  const sessions = useForexStore((s) => s.sessions);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const config = useForexStore((s) => s.tradingConfig);
  const eligibility = sessions?.eligibility;
  const active = new Set(eligibility?.sessions ?? []);
  const connecting = !sessions && (hydratePhase === 'idle' || hydratePhase === 'hydrating');
  const simulated = config?.source === 'SIMULATED' || config?.executionMode === 'MOCK';

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-card px-3 py-1.5 text-[11px]"
      aria-label="Forex sessions"
    >
      <span className="font-medium text-muted-foreground">Sessions</span>
      {connecting ? (
        <span className="text-muted-foreground" role="status">
          Connecting to market…
        </span>
      ) : null}
      {!connecting && FOREX_SESSION_NAMES.map((name) => {
        const isOpen = active.has(name);
        return (
          <span key={name} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn('h-1.5 w-1.5 rounded-full', isOpen ? 'bg-buy' : 'bg-muted-foreground/40')}
            />
            <span className={isOpen ? 'text-foreground' : 'text-muted-foreground'}>{name}</span>
            <span className="text-muted-foreground">{isOpen ? 'Open' : 'Closed'}</span>
          </span>
        );
      })}
      <span className="ml-auto text-muted-foreground">
        Market {eligibility?.open ? 'open' : eligibility?.reason === 'OPEN' ? 'open' : 'closed'}
        {simulated ? ' · Demo quotes · Simulated execution' : ''}
      </span>
    </div>
  );
}
