'use client';

import { useEffect, useState } from 'react';
import { useForexStore } from '@/lib/forex/state/store';
import { cn } from '@/lib/utils';

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
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
      <p className="eda-card border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
        Local only. These alerts stay in this browser and are not server-side guaranteed notifications.
      </p>
      <form
        className="eda-card flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!price.trim()) return;
          setAlerts((cur) => [...cur, { id: `${Date.now()}`, symbol, side, price: price.trim() }]);
          setPrice('');
        }}
      >
        <label className="text-[12px] text-muted-foreground">
          Symbol
          <select className="mt-1 block h-9 rounded-lg border border-border bg-background px-2 text-foreground" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {(symbols.length ? symbols : ['EURUSD']).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-muted-foreground">
          When bid is
          <select className="mt-1 block h-9 rounded-lg border border-border bg-background px-2 text-foreground" value={side} onChange={(e) => setSide(e.target.value as 'above' | 'below')}>
            <option value="above">above</option>
            <option value="below">below</option>
          </select>
        </label>
        <label className="text-[12px] text-muted-foreground">
          Price
          <input className="mt-1 block h-9 rounded-lg border border-border bg-background px-2 font-mono text-foreground" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <button type="submit" className="inline-flex min-h-9 items-center rounded-lg bg-primary px-4 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90">
          Add local alert
        </button>
      </form>
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No local alerts.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {alerts.map((a) => {
            const bid = quotes[a.symbol]?.bid;
            const hit =
              bid != null &&
              ((a.side === 'above' && Number(bid) >= Number(a.price)) || (a.side === 'below' && Number(bid) <= Number(a.price)));
            return (
              <li key={a.id} className={cn('eda-card-interactive flex items-center justify-between px-4 py-3', hit && 'border-primary/40')}>
                <span>
                  {a.symbol} bid {a.side} {a.price}
                  {hit ? ' · triggered locally' : ''}
                </span>
                <button type="button" className="text-[12px] text-primary underline" onClick={() => setAlerts((cur) => cur.filter((x) => x.id !== a.id))}>
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
