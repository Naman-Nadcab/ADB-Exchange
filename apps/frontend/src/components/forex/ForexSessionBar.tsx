'use client';

import { useTranslations } from 'next-intl';
import { FOREX_SESSION_NAMES } from '@/lib/forex/models/types';
import { useForexStore } from '@/lib/forex/state/store';
import { cn } from '@/lib/utils';

export function ForexSessionBar() {
  const ts = useTranslations('forex.sessionBar');
  const sessions = useForexStore((s) => s.sessions);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const config = useForexStore((s) => s.tradingConfig);
  const eligibility = sessions?.eligibility;
  const active = new Set(eligibility?.sessions ?? []);
  const connecting = !sessions && (hydratePhase === 'idle' || hydratePhase === 'hydrating');
  const simulated = config?.source === 'SIMULATED' || config?.executionMode === 'MOCK';

  return (
    <div
      className="forex-chrome-strip flex h-6 shrink-0 items-center gap-x-2.5 overflow-x-auto whitespace-nowrap border-b border-border bg-card px-3 text-[10px]"
      aria-label={ts('ariaLabel')}
    >
      <span className="shrink-0 font-medium text-muted-foreground">{ts('title')}</span>
      {connecting ? (
        <span className="shrink-0 text-muted-foreground" role="status">
          {ts('connecting')}
        </span>
      ) : null}
      {!connecting &&
        FOREX_SESSION_NAMES.map((name) => {
          const isOpen = active.has(name);
          return (
            <span key={name} className="inline-flex shrink-0 items-center gap-1">
              <span
                aria-hidden
                className={cn('h-1.5 w-1.5 rounded-full', isOpen ? 'bg-buy' : 'bg-muted-foreground/40')}
              />
              <span className={isOpen ? 'text-foreground' : 'text-muted-foreground'}>{name}</span>
              <span className="text-muted-foreground">{isOpen ? ts('open') : ts('closed')}</span>
            </span>
          );
        })}
      <span className="ml-auto shrink-0 pl-2 text-muted-foreground">
        {eligibility?.open || eligibility?.reason === 'OPEN' ? ts('marketOpen') : ts('marketClosed')}
        {simulated ? ts('demoSimulated') : ''}
      </span>
    </div>
  );
}
