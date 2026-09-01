'use client';

import { fxNum, fxPlain } from '@/components/forex/format';
import { isQuoteStale } from '@/lib/forex/models/quotes';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useRouter } from 'next/navigation';

export default function ForexMarketsPage() {
  const instruments = useForexStore((s) => s.instruments);
  const quotes = useForexStore((s) => s.quotes);
  const sessions = useForexStore((s) => s.sessions);
  const setSelected = useForexWorkspaceStore((s) => s.setSelectedSymbol);
  const router = useRouter();
  const rows = Object.values(instruments).sort((a, b) => a.symbol.localeCompare(b.symbol));

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-lg font-semibold">Markets</h1>
      <p className="text-[12px] text-stone-500">
        Instruments from GET /instruments. Bid/ask from GET /quotes. Change % is not provided by the quote API.
      </p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-stone-500">Connecting to market…</p>
      ) : (
        <div className="overflow-x-auto rounded border border-stone-200 bg-white dark:border-stone-800 dark:bg-[#101214]">
          <table className="min-w-[760px] w-full text-left font-mono text-[12px]">
            <thead className="text-stone-500">
              <tr>
                <th className="px-3 py-2 font-medium">Symbol</th>
                <th className="px-3 py-2 font-medium">Bid</th>
                <th className="px-3 py-2 font-medium">Ask</th>
                <th className="px-3 py-2 font-medium">Spread</th>
                <th className="px-3 py-2 font-medium">Freshness</th>
                <th className="px-3 py-2 font-medium">Session</th>
                <th className="px-3 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inst) => {
                const q = quotes[inst.symbol];
                return (
                  <tr key={inst.symbol} className="border-t border-stone-100 dark:border-stone-800">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
                        onClick={() => {
                          setSelected(inst.symbol);
                          router.push(FOREX_ROUTES.trade);
                        }}
                      >
                        {inst.displaySymbol ?? inst.symbol}
                      </button>
                    </td>
                    <td className="px-3 py-2">{q ? fxNum(q.bid, inst.digits) : 'Unavailable'}</td>
                    <td className="px-3 py-2">{q ? fxNum(q.ask, inst.digits) : 'Unavailable'}</td>
                    <td className="px-3 py-2">{q ? fxPlain(q.spreadPips) : 'Unavailable'}</td>
                    <td className="px-3 py-2">{q ? (isQuoteStale(q) ? 'STALE' : q.freshness) : 'Unavailable'}</td>
                    <td className="px-3 py-2">{sessions?.eligibility.open ? 'OPEN' : sessions?.eligibility.reason ?? 'Unavailable'}</td>
                    <td className="px-3 py-2 text-stone-500">
                      {inst.symbol === 'XAUUSD'
                        ? 'COMEX gold futures proxy'
                        : inst.symbol === 'XAGUSD'
                          ? 'COMEX silver futures proxy'
                          : 'Yahoo FX'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
