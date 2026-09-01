'use client';

import { useEffect, useState } from 'react';
import { useForexStore } from '@/lib/forex/state/store';

type LocalAlert = {
  id: string;
  symbol: string;
  side: 'above' | 'below';
  price: string;
};

const KEY = 'eda-forex-local-alerts-v1';

export default function ForexAlertsPage() {
  const quotes = useForexStore((s) => s.quotes);
  const instruments = useForexStore((s) => s.instruments);
  const [alerts, setAlerts] = useState<LocalAlert[]>([]);
  const [symbol, setSymbol] = useState('EURUSD');
  const [side, setSide] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setAlerts(JSON.parse(raw) as LocalAlert[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(alerts));
  }, [alerts]);

  const symbols = Object.keys(instruments);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-lg font-semibold">Alerts</h1>
      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        Local only. There is no Forex alerts persistence API. These alerts are stored in this browser and are not server-side.
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!price.trim()) return;
          setAlerts((cur) => [...cur, { id: `${Date.now()}`, symbol, side, price: price.trim() }]);
          setPrice('');
        }}
      >
        <label className="text-[12px]">
          Symbol
          <select className="mt-1 block rounded border border-stone-300 bg-transparent px-2 py-1" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {(symbols.length ? symbols : ['EURUSD']).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px]">
          When bid is
          <select className="mt-1 block rounded border border-stone-300 bg-transparent px-2 py-1" value={side} onChange={(e) => setSide(e.target.value as 'above' | 'below')}>
            <option value="above">above</option>
            <option value="below">below</option>
          </select>
        </label>
        <label className="text-[12px]">
          Price
          <input className="mt-1 block rounded border border-stone-300 bg-transparent px-2 py-1 font-mono" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <button type="submit" className="rounded bg-stone-900 px-3 py-1.5 text-[12px] text-white dark:bg-stone-100 dark:text-stone-900">
          Add local alert
        </button>
      </form>
      {alerts.length === 0 ? (
        <p className="text-[13px] text-stone-500">No local alerts.</p>
      ) : (
        <ul className="space-y-2 text-[13px]">
          {alerts.map((a) => {
            const bid = quotes[a.symbol]?.bid;
            const hit =
              bid != null &&
              ((a.side === 'above' && Number(bid) >= Number(a.price)) || (a.side === 'below' && Number(bid) <= Number(a.price)));
            return (
              <li key={a.id} className="flex items-center justify-between rounded border border-stone-200 px-3 py-2 dark:border-stone-800">
                <span>
                  {a.symbol} bid {a.side} {a.price}
                  {hit ? ' · triggered locally' : ''}
                </span>
                <button type="button" className="text-[12px] underline" onClick={() => setAlerts((cur) => cur.filter((x) => x.id !== a.id))}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
