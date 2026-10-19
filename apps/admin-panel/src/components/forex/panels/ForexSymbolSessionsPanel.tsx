'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminConfig, patchForexInstrumentPolicy } from '@/lib/admin/forex-api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { ForexConfirmModal } from '@/components/forex/primitives/ForexConfirmModal';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';

type SessionWindow = { days: number[]; open: string; close: string } | null;

type InstrumentSession = {
  symbol: string;
  tradeSession?: SessionWindow;
  quoteSession?: SessionWindow;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function readWindow(kind: 'trade' | 'quote', enabledDays: number[]): SessionWindow {
  const open = (document.getElementById(`${kind}-open`) as HTMLInputElement | null)?.value.trim() ?? '';
  const close = (document.getElementById(`${kind}-close`) as HTMLInputElement | null)?.value.trim() ?? '';
  if (!open && !close) return null;
  return { days: enabledDays, open, close };
}

export function ForexSymbolSessionsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [symbol, setSymbol] = useState('');
  const [tradeDays, setTradeDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [quoteDays, setQuoteDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const q = useQuery({
    queryKey: ['admin', 'forex', 'config', 'sessions', token],
    queryFn: async () => {
      const res = await getForexAdminConfig(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      const rows = (res.data.config.instruments ?? []) as InstrumentSession[];
      return rows.filter((r) => r && typeof r.symbol === 'string');
    },
    enabled: !!token,
  });

  const selected = useMemo(() => q.data?.find((r) => r.symbol === symbol), [q.data, symbol]);

  const saveM = useMutation({
    mutationFn: async (reason: string) => {
      const trade = readWindow('trade', tradeDays);
      const quote = readWindow('quote', quoteDays);
      const res = await patchForexInstrumentPolicy(token, symbol, {
        reason,
        trade_session: trade,
        quote_session: quote,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Save failed');
    },
    onSuccess: () => {
      setConfirm(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex'] });
    },
  });

  const toggle = (kind: 'trade' | 'quote', day: number) => {
    const set = kind === 'trade' ? setTradeDays : setQuoteDays;
    set((cur) => (cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day].sort((a, b) => a - b)));
  };

  return (
    <ForexPanelShell
      title="Symbol sessions"
      description="Trade and quote windows are UTC. Blank open and close keeps the 24x5 week. Weekend closure still applies."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="text-xs text-admin-muted">
          Symbol
          <select
            value={symbol}
            onChange={(e) => {
              const next = e.target.value;
              setSymbol(next);
              const row = q.data?.find((r) => r.symbol === next);
              setTradeDays(row?.tradeSession?.days ?? [1, 2, 3, 4, 5]);
              setQuoteDays(row?.quoteSession?.days ?? [1, 2, 3, 4, 5]);
            }}
            className="mt-1 h-9 w-full rounded border border-admin-border bg-admin-bg px-2 text-sm"
          >
            <option value="">Choose symbol…</option>
            {(q.data ?? []).map((r) => (
              <option key={r.symbol} value={r.symbol}>{r.symbol}</option>
            ))}
          </select>
        </label>
      </div>
      {symbol ? (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {(['trade', 'quote'] as const).map((kind) => {
            const days = kind === 'trade' ? tradeDays : quoteDays;
            const saved = kind === 'trade' ? selected?.tradeSession : selected?.quoteSession;
            return (
              <div key={kind} className="rounded border border-admin-border/60 p-3">
                <p className="text-xs text-admin-muted">{kind === 'trade' ? 'Trade session' : 'Quote session'}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {DAY_LABELS.map((label, day) => (
                    <Button key={label} type="button" size="sm" variant={days.includes(day) ? 'primary' : 'outline'} className="h-8 text-xs" onClick={() => toggle(kind, day)}>
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs text-admin-muted">
                    Open UTC
                    <Input id={`${kind}-open`} key={`${symbol}-${kind}-open-${saved?.open ?? ''}`} className="mt-1 h-8 font-mono" defaultValue={saved?.open?.slice(0, 5) ?? ''} placeholder="07:00" />
                  </label>
                  <label className="text-xs text-admin-muted">
                    Close UTC
                    <Input id={`${kind}-close`} key={`${symbol}-${kind}-close-${saved?.close ?? ''}`} className="mt-1 h-8 font-mono" defaultValue={saved?.close?.slice(0, 5) ?? ''} placeholder="17:00" />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <ProtectedAction permission="forex:control" fallback="disabled">
        <Button
          type="button"
          size="sm"
          className="mt-3"
          disabled={!symbol}
          onClick={() => {
            const trade = readWindow('trade', tradeDays);
            const quote = readWindow('quote', quoteDays);
            const bad = [trade, quote].some((w) => w && (!/^\d{2}:\d{2}$/.test(w.open) || !/^\d{2}:\d{2}$/.test(w.close) || w.days.length === 0));
            if (bad) {
              setError('A session needs HH:mm open and close, and at least one day.');
              return;
            }
            setError(null);
            setConfirm(true);
          }}
        >
          Save sessions
        </Button>
      </ProtectedAction>
      <ForexConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Save sessions · ${symbol}`}
        description="Blank times clear the symbol window and leave the 24x5 week in place."
        loading={saveM.isPending}
        onConfirm={async (reason) => {
          await saveM.mutateAsync(reason);
        }}
      />
    </ForexPanelShell>
  );
}
