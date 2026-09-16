'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminPolicy,
  patchForexAdminPolicy,
  patchForexInstrumentPolicy,
  type ForexAdminPolicySnapshot,
} from '@/lib/admin/forex-api';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ForexJsonPanel } from '@/components/forex/ForexJsonPanel';

export function ForexPolicyPanel(props: { mode: 'fees-swaps' | 'margin-risk' }) {
  const { mode } = props;
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const policyQ = useQuery({
    queryKey: ['admin', 'forex', 'policy', token],
    queryFn: async () => {
      const res = await getForexAdminPolicy(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const patchM = useMutation({
    mutationFn: async (body: Parameters<typeof patchForexAdminPolicy>[1]) => {
      const res = await patchForexAdminPolicy(token, body);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Update failed');
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'forex'] }),
  });

  const instM = useMutation({
    mutationFn: async (args: { symbol: string; max_leverage: string }) => {
      const res = await patchForexInstrumentPolicy(token, args.symbol, { reason, max_leverage: args.max_leverage });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Instrument update failed');
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'forex'] }),
  });

  const snap = policyQ.data as ForexAdminPolicySnapshot | undefined;

  const saveGlobal = (partial: Omit<Parameters<typeof patchForexAdminPolicy>[1], 'reason'>) => {
    if (reason.length < 8) {
      alert('Reason min 8 characters required.');
      return;
    }
    patchM.mutate({ ...partial, reason });
  };

  return (
    <div className="space-y-4">
      <Card className="border-violet-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">F4 policy edit</h3>
              <p className="text-xs text-admin-muted">
                Runtime until restart · audited · requires <code className="text-[10px]">settings:edit</code>
              </p>
            </div>
            <Badge variant="info" className="font-normal">
              {mode === 'fees-swaps' ? 'Fees & swaps' : 'Margin & leverage'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Change reason (min 8 chars)" value={reason} onChange={(e) => setReason(e.target.value)} className="h-9" />
          {patchM.isError ? (
            <p className="text-sm text-red-400">{patchM.error instanceof Error ? patchM.error.message : 'Update failed'}</p>
          ) : null}
        </CardContent>
      </Card>

      {snap && mode === 'margin-risk' ? (
        <Card>
          <CardHeader className="pb-2 text-sm font-semibold">Leverage</CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-admin-muted">
              Global max
              <Input
                defaultValue={snap.leverage.effective.globalMax}
                className="mt-1 h-9"
                id="fx-global-max-lev"
              />
            </label>
            <label className="text-xs text-admin-muted">
              Default account max
              <Input defaultValue={snap.leverage.effective.defaultAccount} className="mt-1 h-9" id="fx-default-lev" />
            </label>
            <ProtectedAction permission="settings:edit" fallback="disabled">
              <Button
                type="button"
                size="sm"
                disabled={patchM.isPending}
                onClick={() => {
                  const global_max = (document.getElementById('fx-global-max-lev') as HTMLInputElement)?.value;
                  const default_account = (document.getElementById('fx-default-lev') as HTMLInputElement)?.value;
                  saveGlobal({ leverage: { global_max, default_account } });
                }}
              >
                Save leverage
              </Button>
            </ProtectedAction>
          </CardContent>
        </Card>
      ) : null}

      {snap && mode === 'margin-risk' ? (
        <Card>
          <CardHeader className="pb-2 text-sm font-semibold">Margin levels (%)</CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-admin-muted">
              Warning
              <Input defaultValue={snap.margin.effective.warningLevel} className="mt-1 h-9" id="fx-m-warn" />
            </label>
            <label className="text-xs text-admin-muted">
              Call
              <Input defaultValue={snap.margin.effective.callLevel} className="mt-1 h-9" id="fx-m-call" />
            </label>
            <label className="text-xs text-admin-muted">
              Stop-out
              <Input defaultValue={snap.margin.effective.stopOutLevel} className="mt-1 h-9" id="fx-m-stop" />
            </label>
            <ProtectedAction permission="settings:edit" fallback="disabled">
              <Button
                type="button"
                size="sm"
                disabled={patchM.isPending}
                onClick={() =>
                  saveGlobal({
                    margin: {
                      warning_level: (document.getElementById('fx-m-warn') as HTMLInputElement)?.value,
                      call_level: (document.getElementById('fx-m-call') as HTMLInputElement)?.value,
                      stop_out_level: (document.getElementById('fx-m-stop') as HTMLInputElement)?.value,
                    },
                  })
                }
              >
                Save margin levels
              </Button>
            </ProtectedAction>
          </CardContent>
        </Card>
      ) : null}

      {snap && mode === 'fees-swaps' ? (
        <Card>
          <CardHeader className="pb-2 text-sm font-semibold">Global commission</CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-admin-muted">
              Model
              <select id="fx-comm-model" defaultValue={snap.commission.global.model} className="mt-1 h-9 w-full rounded border border-admin-border bg-admin-bg px-2 text-sm">
                <option value="none">none</option>
                <option value="per_lot">per_lot</option>
                <option value="per_side">per_side</option>
                <option value="percentage">percentage</option>
              </select>
            </label>
            <label className="text-xs text-admin-muted">
              Rate
              <Input defaultValue={snap.commission.global.rate} className="mt-1 h-9" id="fx-comm-rate" />
            </label>
            <ProtectedAction permission="settings:edit" fallback="disabled">
              <Button
                type="button"
                size="sm"
                className="self-end"
                disabled={patchM.isPending}
                onClick={() =>
                  saveGlobal({
                    commission: {
                      model: (document.getElementById('fx-comm-model') as HTMLSelectElement)?.value,
                      rate: (document.getElementById('fx-comm-rate') as HTMLInputElement)?.value,
                    },
                  })
                }
              >
                Save commission
              </Button>
            </ProtectedAction>
          </CardContent>
        </Card>
      ) : null}

      {snap && mode === 'fees-swaps' ? (
        <Card>
          <CardHeader className="pb-2 text-sm font-semibold">Global swap / rollover</CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-admin-muted">
              Long swap
              <Input defaultValue={snap.swaps.global.longSwap} className="mt-1 h-9" id="fx-swap-long" />
            </label>
            <label className="text-xs text-admin-muted">
              Short swap
              <Input defaultValue={snap.swaps.global.shortSwap} className="mt-1 h-9" id="fx-swap-short" />
            </label>
            <label className="text-xs text-admin-muted">
              Rollover (HH:mm)
              <Input defaultValue={snap.swaps.global.rolloverTime} className="mt-1 h-9" id="fx-swap-roll" />
            </label>
            <label className="text-xs text-admin-muted">
              Timezone
              <Input defaultValue={snap.swaps.global.timezone} className="mt-1 h-9" id="fx-swap-tz" />
            </label>
            <ProtectedAction permission="settings:edit" fallback="disabled">
              <Button
                type="button"
                size="sm"
                disabled={patchM.isPending}
                onClick={() =>
                  saveGlobal({
                    swap: {
                      long_swap: (document.getElementById('fx-swap-long') as HTMLInputElement)?.value,
                      short_swap: (document.getElementById('fx-swap-short') as HTMLInputElement)?.value,
                      rollover_time: (document.getElementById('fx-swap-roll') as HTMLInputElement)?.value,
                      timezone: (document.getElementById('fx-swap-tz') as HTMLInputElement)?.value,
                    },
                  })
                }
              >
                Save swap policy
              </Button>
            </ProtectedAction>
          </CardContent>
        </Card>
      ) : null}

      {snap && mode === 'margin-risk' ? (
        <Card>
          <CardHeader className="pb-2 text-sm font-semibold">Instrument max leverage</CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-xs">
              <thead>
                <tr className="border-b border-admin-border text-admin-muted">
                  <th className="py-2 text-left">Symbol</th>
                  <th className="py-2 text-left">Effective</th>
                  <th className="py-2 text-left">Catalog</th>
                  <th className="py-2 text-left">Set</th>
                </tr>
              </thead>
              <tbody>
                {snap.instruments.map((row) => (
                  <tr key={row.symbol} className="border-b border-admin-border/40">
                    <td className="py-2">{row.displaySymbol}</td>
                    <td className="py-2">{row.effective.maxLeverage}</td>
                    <td className="py-2 text-admin-muted">{row.catalog.maxLeverage}</td>
                    <td className="py-2">
                      <ProtectedAction permission="settings:edit" fallback="disabled">
                        <Input
                          className="inline h-8 w-20"
                          defaultValue={row.effective.maxLeverage}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (!v || v === row.effective.maxLeverage) return;
                            if (reason.length < 8) {
                              alert('Enter reason above first.');
                              e.target.value = row.effective.maxLeverage;
                              return;
                            }
                            instM.mutate({ symbol: row.symbol, max_leverage: v });
                          }}
                        />
                      </ProtectedAction>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {snap ? <ForexJsonPanel title="Risk limits snapshot" data={snap.riskLimits} /> : null}
    </div>
  );
}
