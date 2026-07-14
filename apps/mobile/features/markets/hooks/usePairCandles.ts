import { useQuery } from '@tanstack/react-query';
import { getSpotRepository } from '@core/repositories/SpotRepository';

export function usePairCandles(symbol: string, interval: number) {
  return useQuery({
    queryKey: ['candles', symbol, interval],
    queryFn: () => getSpotRepository().getCandles(symbol, interval),
    staleTime: 30_000,
    enabled: !!symbol,
  });
}
