import { useQuery } from '@tanstack/react-query';
import { getWalletRepository } from '@core/repositories/WalletRepository';
import type { CoinInfo } from '@exchange/mobile-types';

export function useMarketsCoinInfo(baseAsset: string) {
  return useQuery({
    queryKey: ['markets', 'coinInfo', baseAsset],
    queryFn: (): Promise<CoinInfo> => getWalletRepository().getCoinInfo(baseAsset),
    staleTime: 60 * 60_000,
    enabled: !!baseAsset,
    retry: 1,
  });
}
