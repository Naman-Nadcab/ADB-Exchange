import { useCallback, useState } from 'react';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import { normalizeSymbol } from '@core/domain/markets/marketUtils';

function loadFavorites(): string[] {
  const raw = mmkvStorage.getString(CACHE_KEYS.favorites);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);

  const persist = useCallback((next: string[]) => {
    mmkvStorage.set(CACHE_KEYS.favorites, JSON.stringify(next));
    setFavorites(next);
  }, []);

  const toggle = useCallback(
    (symbol: string) => {
      const s = normalizeSymbol(symbol);
      const next = favorites.includes(s)
        ? favorites.filter((f) => f !== s)
        : [...favorites, s];
      persist(next);
    },
    [favorites, persist],
  );

  const isFavorite = useCallback((symbol: string) => favorites.includes(normalizeSymbol(symbol)), [favorites]);

  return { favorites, toggle, isFavorite };
}
