'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminControls,
  patchForexAdminControls,
  patchForexInstrumentTradingStatus,
  type ForexAdminControlsSnapshot,
} from '@/lib/admin/forex-api';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function FlagRow(props: {
  label: string;
  description: string;
  effective: boolean;
  env: boolean;
  dangerous?: boolean;
  onToggle: (next: boolean) => void;
  pending?: boolean;
}) {
  const overridden = props.effective !== props.env;
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
        props.dangerous ? 'border-red-500/30 bg-red-500/5' : 'border-admin-border/80 bg-admin-bg/40'
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{props.label}</span>
          <Badge variant={props.effective ? 'danger' : 'success'} className="font-normal">
            {props.effective ? 'ON' : 'OFF'}
          </Badge>
          {overridden ? (
            <Badge variant="warning" className="text-[10px] font-normal">
              Runtime override (env {props.env ? 'ON' : 'OFF'})
            </Badge>
          ) : (
            <Badge variant="default" className="text-[10px] font-normal">
              Matches env
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-admin-muted">{props.description}</p>
      </div>
      <ProtectedAction permission="control:trading" fallback="disabled">
        <Button
          type="button"
          size="sm"
          variant={props.dangerous ? 'danger' : 'secondary'}
          disabled={props.pending}
          onClick={() => props.onToggle(!props.effective)}
        >
          Turn {props.effective ? 'OFF' : 'ON'}
        </Button>
      </ProtectedAction>
    </div>
  );
}

export function ForexGlobalControlsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const controlsQ = useQuery({
    queryKey: ['admin', 'forex', 'controls', token],
    queryFn: async () => {
      const res = await getForexAdminControls(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 10_000,
  });

  const patchM = useMutation({
    mutationFn: async (body: Parameters<typeof patchForexAdminControls>[1]) => {
      const res = await patchForexAdminControls(token, body);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Update failed');
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'forex'] });
    },
  });

  const instrumentM = useMutation({
    mutationFn: async (args: { symbol: string; trading_status: string; reason: string }) => {
      const res = await patchForexInstrumentTradingStatus(token, args.symbol, {
        trading_status: args.trading_status,
        reason: args.reason,
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Instrument update failed');
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'forex'] });
    },
  });

  const snap = controlsQ.data as ForexAdminControlsSnapshot | undefined;

  const applyBool = (key: 'kill_switch' | 'demo_funding' | 'funding_test_api' | 'execution_test_api', next: boolean) => {
    patchM.mutate({ reason, [key]: next });
  };

  return (
    <div className="space-y-4">
      <Card className="border-violet-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Global runtime controls</h3>
              <p className="text-xs text-admin-muted">
                In-process overrides until backend restart. All changes are audit-logged. Requires{' '}
                <code className="text-[10px]">control:trading</code>.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => void controlsQ.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Change reason (min 8 chars for kill / enable demo funding)</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ops ticket or incident reference" className="h-9" />
          </div>
          {snap ? (
            <>
              <FlagRow
                label="Global kill switch"
                description="Reject new Forex orders platform-wide (MOCK venue)."
                effective={snap.effective.killSwitch}
                env={snap.envBaseline.killSwitch}
                dangerous
                pending={patchM.isPending}
                onToggle={(n) => applyBool('kill_switch', n)}
              />
              <FlagRow
                label="Demo funding"
                description="Allow customer demo ledger credits (Forex ledger only)."
                effective={snap.effective.demoFundingEnabled}
                env={snap.envBaseline.demoFundingEnabled}
                pending={patchM.isPending}
                onToggle={(n) => applyBool('demo_funding', n)}
              />
              <FlagRow
                label="Funding test API"
                description="Ops SIMULATED header for funding test routes."
                effective={snap.effective.fundingTestApiEnabled}
                env={snap.envBaseline.fundingTestApiEnabled}
                pending={patchM.isPending}
                onToggle={(n) => applyBool('funding_test_api', n)}
              />
              <FlagRow
                label="Execution test API"
                description="SIMULATED test execution endpoint gate."
                effective={snap.effective.executionTestApiEnabled}
                env={snap.envBaseline.executionTestApiEnabled}
                pending={patchM.isPending}
                onToggle={(n) => applyBool('execution_test_api', n)}
              />
              <div className="rounded-lg border border-admin-border/60 bg-admin-bg/30 p-3 text-xs text-admin-muted">
                <p>
                  Economic ready:{' '}
                  <strong className={snap.readiness.economicReady ? 'text-emerald-400' : 'text-amber-400'}>
                    {snap.readiness.economicReady ? 'YES' : 'NO'}
                  </strong>
                  {snap.readiness.reason ? ` — ${snap.readiness.reason}` : null}
                </p>
              </div>
            </>
          ) : controlsQ.isLoading ? (
            <p className="text-sm text-admin-muted">Loading controls…</p>
          ) : null}
          {patchM.isError ? (
            <p className="flex items-center gap-1 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4" />
              {patchM.error instanceof Error ? patchM.error.message : 'Update failed'}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {snap ? (
        <Card className="border-violet-500/20">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold">Per-instrument trading status</h3>
            <p className="text-xs text-admin-muted">Halt or close-only a symbol without redeploy. Reason required.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead>
                <tr className="border-b border-admin-border text-admin-muted">
                  <th className="py-2 pr-2">Symbol</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Override</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {snap.instruments.map((row) => (
                  <tr key={row.symbol} className="border-b border-admin-border/50">
                    <td className="py-2 pr-2 font-medium">{row.displaySymbol}</td>
                    <td className="py-2 pr-2">
                      <Badge
                        variant={row.tradingStatus === 'active' ? 'success' : row.tradingStatus === 'halted' ? 'danger' : 'warning'}
                        className="font-normal"
                      >
                        {row.tradingStatus}
                      </Badge>
                    </td>
                    <td className="py-2 pr-2 text-admin-muted">{row.overridden ? 'Yes' : 'No'}</td>
                    <td className="py-2">
                      <ProtectedAction permission="control:trading" fallback="disabled">
                        <select
                          className="mr-1 h-8 rounded border border-admin-border bg-admin-bg px-1"
                          defaultValue={row.tradingStatus}
                          disabled={instrumentM.isPending}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === row.tradingStatus) return;
                            if (reason.length < 8) {
                              alert('Enter a reason (min 8 characters) in the box above first.');
                              e.target.value = row.tradingStatus;
                              return;
                            }
                            instrumentM.mutate({ symbol: row.symbol, trading_status: v, reason });
                          }}
                        >
                          <option value="active">active</option>
                          <option value="halted">halted</option>
                          <option value="closed">closed</option>
                        </select>
                      </ProtectedAction>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {instrumentM.isError ? (
              <p className="mt-2 text-sm text-red-400">
                {instrumentM.error instanceof Error ? instrumentM.error.message : 'Instrument update failed'}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
