import { useCallback, useState } from 'react';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import { normalizeSymbol } from '@core/domain/markets/marketUtils';

const MAX_RECENT = 20;

function loadRecent(): string[] {
  const raw = mmkvStorage.getString(CACHE_KEYS.recentMarkets);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function useRecentMarkets() {
  const [recent, setRecent] = useState<string[]>(loadRecent);

  const addRecent = useCallback((symbol: string) => {
    const s = normalizeSymbol(symbol);
    setRecent((prev) => {
      const next = [s, ...prev.filter((r) => r !== s)].slice(0, MAX_RECENT);
      mmkvStorage.set(CACHE_KEYS.recentMarkets, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recent, addRecent };
}
