import { describe, it, expect } from '@jest/globals';
import { getStateFromPath } from '@react-navigation/native';
import { linking } from '@app/navigation/linking';

/** Extract deepest focused route name from getStateFromPath result. */
function resolveLeafRoute(path: string): string | undefined {
  const state = getStateFromPath(path, linking.config as never);
  if (!state) return undefined;
  let current: { routes?: { name: string; state?: unknown }[]; index?: number } | undefined = state as {
    routes?: { name: string; state?: unknown }[];
    index?: number;
  };
  while (current?.routes?.length) {
    const idx = current.index ?? 0;
    const route = current.routes[idx];
    if (!route) return undefined;
    if (!route.state) return route.name;
    current = route.state as typeof current;
  }
  return undefined;
}

describe('deep link path resolution (runtime getStateFromPath)', () => {
  const walletCases: { path: string; expected: string }[] = [
    { path: 'wallet/funding', expected: 'FundingAccount' },
    { path: 'wallet/unified', expected: 'TradingAccount' },
    { path: 'wallet/transfer', expected: 'Transfer' },
    { path: 'wallet/deposit', expected: 'DepositHome' },
    { path: 'wallet/history', expected: 'WalletHistory' },
    { path: 'wallet/pnl', expected: 'WalletPnl' },
    { path: 'wallet/convert', expected: 'Convert' },
    { path: 'wallet/withdraw', expected: 'WithdrawHome' },
    { path: 'wallet/BTC', expected: 'AssetDetail' },
  ];

  it.each(walletCases)('wallet path $path → $expected', ({ path, expected }) => {
    expect(resolveLeafRoute(path)).toBe(expected);
  });

  it('markets/search → MarketSearch', () => {
    expect(resolveLeafRoute('markets/search')).toBe('MarketSearch');
  });

  it('markets/BTC_USDT → PairDetail', () => {
    expect(resolveLeafRoute('markets/BTC_USDT')).toBe('PairDetail');
  });

  it('trade/pairs → PairSelector', () => {
    expect(resolveLeafRoute('trade/pairs')).toBe('PairSelector');
  });

  it('trade/BTC_USDT → SpotTrading', () => {
    expect(resolveLeafRoute('trade/BTC_USDT')).toBe('SpotTrading');
  });
});
