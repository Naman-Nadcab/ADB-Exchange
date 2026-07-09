'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Loader2, Database, Radio, Cpu } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { OperatorSection, SettingHint } from '@/components/admin-shell/OperatorSection';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { useAdminToast } from '@/components/admin-shell/AdminToast';
import { formatSaveError } from '@/lib/admin-save-feedback';
import {
  getIndexerStatus,
  getOracleStatus,
  patchOracleSettings,
  getEngineRecoveryStatus,
} from '@/lib/integrations-ops-api';

export function InfrastructureOpsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const toast = useAdminToast();
  const [oracleProvider, setOracleProvider] = useState('');
  const [oracleInterval, setOracleInterval] = useState('60');

  const indexerQ = useQuery({
    queryKey: ['admin', 'indexer-status', token],
    queryFn: () => getIndexerStatus(token),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const oracleQ = useQuery({
    queryKey: ['admin', 'oracle-status', token],
    queryFn: () => getOracleStatus(token),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const engineQ = useQuery({
    queryKey: ['admin', 'engine-recovery', token],
    queryFn: () => getEngineRecoveryStatus(token),
    enabled: !!token,
    refetchInterval: 20_000,
  });

  const oracleMut = useMutation({
    mutationFn: () =>
      patchOracleSettings(token, {
        provider: oracleProvider.trim() || undefined,
        updateIntervalSec: Number(oracleInterval) || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'oracle-status'] });
      toast.success('Oracle settings saved.');
    },
    onError: (e) => toast.error(formatSaveError(e, 'Failed to save oracle settings.')),
  });

  const chains = indexerQ.data?.data?.chains ?? [];
  const oracle = oracleQ.data?.data;
  const engine = engineQ.data?.data;

  useEffect(() => {
    if (oracle?.provider && !oracleProvider) setOracleProvider(oracle.provider);
    if (oracle?.updateIntervalSec != null && oracleInterval === '60') {
      setOracleInterval(String(oracle.updateIntervalSec));
    }
  }, [oracle?.provider, oracle?.updateIntervalSec, oracleProvider, oracleInterval]);

  return (
    <div className="space-y-4">
      <OperatorSection
        title="Deposit indexer"
        description="Blockchain deposit detection sync status per chain."
        help="Shows last processed block and pending deposits from the indexer service."
        auditHref="/audit/config"
        lastUpdated={indexerQ.dataUpdatedAt ? new Date(indexerQ.dataUpdatedAt).toLocaleString() : null}
        actions={
          <Button variant="ghost" size="sm" onClick={() => void indexerQ.refetch()}>
            Refresh
          </Button>
        }
      >
        {indexerQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-admin-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : chains.length === 0 ? (
          <p className="text-sm text-admin-muted">No indexer chains reported. Configure RPC providers in <Link href="/system/integrations" className="text-admin-accent underline">Integrations Center</Link>.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-admin-muted">
                <tr>
                  {['Chain', 'Block', 'Pending', 'Confirming', 'Sync'].map((h) => (
                    <th key={h} className="pb-2 pr-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chains.map((c) => (
                  <tr key={c.chainId ?? c.chain} className="border-t border-admin-border/30">
                    <td className="py-2 pr-3 font-medium">{c.chain}</td>
                    <td className="py-2 pr-3 font-mono">{c.last_processed_block ?? '—'}</td>
                    <td className="py-2 pr-3">{c.pending_deposits ?? 0}</td>
                    <td className="py-2 pr-3">{c.confirming_deposits ?? 0}</td>
                    <td className="py-2">
                      <Badge variant={c.sync_status === 'syncing' ? 'warning' : 'success'} size="sm">{c.sync_status ?? 'idle'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OperatorSection>

      <OperatorSection
        title="Price oracle"
        description="External price feed health and configuration."
        help="Oracle prices drive mark prices and risk checks. Failover provider is used when primary is stale."
        auditHref="/audit/config"
        lastUpdated={oracle?.lastUpdate ? new Date(oracle.lastUpdate).toLocaleString() : null}
      >
        {oracleQ.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-admin-muted" />
        ) : (
          <>
            <div className="mb-4 grid gap-2 sm:grid-cols-4 text-xs">
              <div><span className="text-admin-muted">Provider</span><p className="font-medium">{oracle?.provider ?? '—'}</p></div>
              <div><span className="text-admin-muted">Interval</span><p className="font-medium">{oracle?.updateIntervalSec ?? '—'}s</p></div>
              <div><span className="text-admin-muted">Latency</span><p className="font-medium">{oracle?.lastLatencyMs ?? '—'}ms</p></div>
              <div><span className="text-admin-muted">Last error</span><p className="truncate text-red-400/80">{oracle?.lastError ?? '—'}</p></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
              <div>
                <label className="text-[10px] font-medium text-admin-muted">Provider</label>
                <input
                  className="mt-1 w-full rounded-lg border border-admin-border bg-admin-surface px-2 py-1.5 text-sm"
                  defaultValue={oracle?.provider ?? ''}
                  onChange={(e) => setOracleProvider(e.target.value)}
                  placeholder="binance"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-admin-muted">Update interval (sec)</label>
                <input
                  className="mt-1 w-full rounded-lg border border-admin-border bg-admin-surface px-2 py-1.5 text-sm"
                  defaultValue={String(oracle?.updateIntervalSec ?? 60)}
                  onChange={(e) => setOracleInterval(e.target.value)}
                  inputMode="numeric"
                />
                <SettingHint impact="How often spot prices refresh." restart={false} risk="medium" recommended="60" />
              </div>
            </div>
            <ProtectedAction permission="settings:edit" fallback="disabled">
              <Button size="sm" className="mt-3" onClick={() => oracleMut.mutate()} disabled={oracleMut.isPending}>
                {oracleMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span className="ml-1">Save oracle settings</span>
              </Button>
            </ProtectedAction>
          </>
        )}
      </OperatorSection>

      <OperatorSection
        title="Matching engine recovery"
        description="Open orders and settlement cursor after restarts."
        help="High open order count after recovery may indicate the engine needs reconciliation."
        auditHref="/admin-control"
        actions={<Link href="/trading" className="text-xs text-admin-accent hover:underline">Trading engine →</Link>}
      >
        {engineQ.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-admin-muted" />
        ) : (
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-admin-muted" /> Open orders: <strong>{engine?.open_orders ?? '—'}</strong></div>
            <div className="flex items-center gap-2"><Database className="h-4 w-4 text-admin-muted" /> State: <strong>{String(engine?.recovery_state ?? 'unknown')}</strong></div>
            <div className="flex items-center gap-2"><Radio className="h-4 w-4 text-admin-muted" /> Cursor: <code className="text-xs">{JSON.stringify(engine?.settlement_cursor ?? null)}</code></div>
          </div>
        )}
      </OperatorSection>
    </div>
  );
}
