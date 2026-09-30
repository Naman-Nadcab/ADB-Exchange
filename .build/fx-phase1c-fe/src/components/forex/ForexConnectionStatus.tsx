'use client';

import { FOREX_PRODUCT } from '@/lib/forex/brand';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { deriveDisplayConnection } from '@/lib/forex/selectors/connection';
import { cn } from '@/lib/utils';

const LABEL: Record<string, string> = {
  CONNECTED: FOREX_PRODUCT.statusConnected,
  CONNECTING: 'Connecting to simulated market…',
  RECONNECTING: 'Reconnecting · DEMO',
  DEGRADED: 'Degraded · DEMO',
  STALE: 'Stale quotes · DEMO',
  DISCONNECTED: 'Disconnected',
};

export function ForexConnectionStatus() {
  const socketState = useForexStore((s) => s.socketState);
  const quotes = useForexStore((s) => s.quotes);
  const providers = useForexStore((s) => s.providerHealth);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const selectedSymbol = useForexWorkspaceStore((s) => s.selectedSymbol);
  const state = deriveDisplayConnection({ socketState, quotes, selectedSymbol, providers, hydratePhase });

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wide',
        state === 'CONNECTED' && 'text-amber-200',
        state === 'STALE' && 'text-primary',
        state === 'DEGRADED' && 'text-primary',
        (state === 'DISCONNECTED' || state === 'RECONNECTING' || state === 'CONNECTING') &&
          'text-muted-foreground'
      )}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          state === 'CONNECTED' && 'bg-amber-400',
          state === 'STALE' && 'bg-primary',
          state === 'DEGRADED' && 'bg-primary',
          state !== 'CONNECTED' && state !== 'STALE' && state !== 'DEGRADED' && 'bg-muted-foreground'
        )}
      />
      <span>{LABEL[state] ?? state}</span>
      <span className="sr-only">Forex connection {state}</span>
    </span>
  );
}
