'use client';

import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { deriveDisplayConnection } from '@/lib/forex/selectors/connection';
import { cn } from '@/lib/utils';

const LABEL: Record<string, string> = {
  CONNECTED: 'Live',
  CONNECTING: 'Connecting to market…',
  RECONNECTING: 'Reconnecting',
  DEGRADED: 'Degraded',
  STALE: 'Stale quotes',
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
        state === 'CONNECTED' && 'text-emerald-700 dark:text-emerald-400',
        state === 'STALE' && 'text-amber-700 dark:text-amber-400',
        state === 'DEGRADED' && 'text-amber-800 dark:text-amber-300',
        (state === 'DISCONNECTED' || state === 'RECONNECTING' || state === 'CONNECTING') &&
          'text-stone-500 dark:text-stone-400'
      )}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          state === 'CONNECTED' && 'bg-emerald-600',
          state === 'STALE' && 'bg-amber-500',
          state === 'DEGRADED' && 'bg-amber-600',
          state !== 'CONNECTED' && state !== 'STALE' && state !== 'DEGRADED' && 'bg-stone-400'
        )}
      />
      <span>{LABEL[state] ?? state}</span>
      <span className="sr-only">Forex connection {state}</span>
    </span>
  );
}
