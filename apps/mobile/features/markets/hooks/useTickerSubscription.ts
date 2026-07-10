import { useEffect } from 'react';
import { useWs } from '@app/providers/WsProvider';
import { normalizeSymbol } from '@core/domain/markets/marketUtils';

/** Subscribe to live ticker — cleans up on unmount/blur. */
export function useTickerSubscription(symbol: string | null) {
  const { subscriptions } = useWs();

  useEffect(() => {
    if (!symbol) return;
    const normalized = normalizeSymbol(symbol);
    const unsub = subscriptions.subscribeTicker(normalized);
    return unsub;
  }, [symbol, subscriptions]);
}

/** Subscribe to visible symbols only (memory-safe batch). */
export function useVisibleTickerSubscriptions(symbols: string[]) {
  const { subscriptions } = useWs();

  useEffect(() => {
    const key = symbols.join(',');
    if (!key) return;
    const unsubs = symbols.map((s) => subscriptions.subscribeTicker(normalizeSymbol(s)));
    return () => unsubs.forEach((u) => u());
  }, [symbols, subscriptions]);
}
