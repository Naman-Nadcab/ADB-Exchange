'use client';

import { useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/Badge';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexRouteWorkspace } from '@/components/forex/primitives/ForexRouteWorkspace';
import { ForexConfirmModal } from '@/components/forex/primitives/ForexConfirmModal';
import {
  extractForexApprovalPending,
  ForexApprovalPendingNotice,
  type ForexApprovalPendingInfo,
} from '@/components/forex/primitives/ForexApprovalPendingNotice';

type PolicyForm = {
  globalMaxLev: string;
  defaultLev: string;
  warnLevel: string;
  callLevel: string;
  stopOut: string;
  maintenanceRatio: string;
  commModel: string;
  commRate: string;
  commMinimum: string;
  swapLong: string;
  swapShort: string;
  swapRoll: string;
  swapTz: string;
  tripleSwapDay: string;
};

const TRIPLE_SWAP_DAYS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
] as const;

function positiveDecimal(raw: string): string | null {
  const v = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return v;
}

function formFromSnap(snap: ForexAdminPolicySnapshot): PolicyForm {
  const day = snap.swaps.global.tripleSwapDay;
  return {
    globalMaxLev: snap.leverage.effective.globalMax,
    defaultLev: snap.leverage.effective.defaultAccount,
    warnLevel: snap.margin.effective.warningLevel,
    callLevel: snap.margin.effective.callLevel,
    stopOut: snap.margin.effective.stopOutLevel,
    maintenanceRatio: snap.margin.effective.maintenanceRatio ?? '',
    commModel: snap.commission.global.model,
    commRate: snap.commission.global.rate ?? '',
    commMinimum: snap.commission.global.minimum ?? '0',
    swapLong: snap.swaps.global.longSwap,
    swapShort: snap.swaps.global.shortSwap,
    swapRoll: snap.swaps.global.rolloverTime,
    swapTz: snap.swaps.global.timezone,
    tripleSwapDay: Number.isInteger(day) && day >= 0 && day <= 6 ? String(day) : '3',
  };
}

export function ForexPolicyPanel(props: { mode: 'fees-swaps' | 'margin-risk' }) {
  const { mode } = props;
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [form, setForm] = useState<PolicyForm | null>(null);
  const [saveIntent, setSaveIntent] = useState<'leverage' | 'margin' | 'commission' | 'swap' | null>(null);
  const [instLeverage, setInstLeverage] = useState<{ symbol: string; display: string; value: string } | null>(null);
  const [instVolume, setInstVolume] = useState<{ symbol: string; display: string; min: string; max: string } | null>(null);
  const [volumeFormError, setVolumeFormError] = useState<string | null>(null);
  const [approvalNotice, setApprovalNotice] = useState<ForexApprovalPendingInfo | null>(null);

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

  const snap = policyQ.data;

  useEffect(() => {
    if (snap) setForm(formFromSnap(snap));
  }, [snap]);

  const patchM = useMutation({
    mutationFn: async (body: Parameters<typeof patchForexAdminPolicy>[1]) => {
      const res = await patchForexAdminPolicy(token, body);
      if (!res.success) throw new Error(res.error?.message ?? 'Update failed');
      return res;
    },
    onSuccess: (res) => {
      const pending = extractForexApprovalPending(res.data, res.meta?.httpStatus);
      setApprovalNotice(pending);
      if (!pending) void qc.invalidateQueries({ queryKey: ['admin', 'forex'] });
      setSaveIntent(null);
    },
  });

  const instM = useMutation({
    mutationFn: async (args: { symbol: string; max_leverage: string; reason: string }) => {
      const res = await patchForexInstrumentPolicy(token, args.symbol, {
        reason: args.reason,
        max_leverage: args.max_leverage,
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Instrument update failed');
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'forex'] });
      setInstLeverage(null);
    },
  });

  const volM = useMutation({
    mutationFn: async (args: { symbol: string; min_volume: string; max_volume: string; reason: string }) => {
      const res = await patchForexInstrumentPolicy(token, args.symbol, {
        reason: args.reason,
        min_volume: args.min_volume,
        max_volume: args.max_volume,
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Volume update failed');
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'forex'] });
      setInstVolume(null);
      setVolumeFormError(null);
    },
  });

  const patchWithReason = (partial: Omit<Parameters<typeof patchForexAdminPolicy>[1], 'reason'>, reason: string) => {
    patchM.mutate({ ...partial, reason });
  };

  const setField = <K extends keyof PolicyForm>(key: K, value: PolicyForm[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  if (!form && policyQ.isLoading) {
    return <p className="text-sm text-admin-muted">Loading policy…</p>;
  }

  const routeId = mode === 'fees-swaps' ? 'fees-swaps' : 'margin-risk';

  return (
    <div className="space-y-4">
      <ForexRouteWorkspace
        routeId={routeId}
        kpis={
          form
            ? [
                { label: 'Global max lev.', value: `${form.globalMaxLev}×` },
                { label: 'Stop-out', value: `${form.stopOut}%`, tone: 'warning' },
                { label: 'Commission', value: form.commModel },
                { label: 'Swap TZ', value: form.swapTz || '—' },
              ]
            : undefined
        }
      />
      <ForexApprovalPendingNotice info={approvalNotice} onDismiss={() => setApprovalNotice(null)} />
      <ForexPanelShell
        title="Policy change"
        description="Runtime overrides until backend restart · every save is audit-logged"
        actions={
          <Badge variant="info" className="font-normal">
            {mode === 'fees-swaps' ? 'Fees & swaps' : 'Margin & leverage'}
          </Badge>
        }
      >
        <p className="text-xs text-admin-muted">
          Confirm each save with an audit reason (minimum 8 characters). Requires settings edit permission.
        </p>
        {patchM.isError ? (
          <p className="mt-2 text-sm text-admin-danger">{patchM.error instanceof Error ? patchM.error.message : 'Update failed'}</p>
        ) : null}
      </ForexPanelShell>

      {form && mode === 'margin-risk' ? (
        <ForexPanelShell title="Leverage caps">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-admin-muted">
              Global max
              <Input value={form.globalMaxLev} onChange={(e) => setField('globalMaxLev', e.target.value)} className="mt-1 h-9" />
            </label>
            <label className="text-xs text-admin-muted">
              Default account max
              <Input value={form.defaultLev} onChange={(e) => setField('defaultLev', e.target.value)} className="mt-1 h-9" />
            </label>
          </div>
          <ProtectedAction permission="forex:control" fallback="disabled">
            <Button type="button" size="sm" className="mt-3" disabled={patchM.isPending} onClick={() => setSaveIntent('leverage')}>
              Save leverage
            </Button>
          </ProtectedAction>
        </ForexPanelShell>
      ) : null}

      {form && mode === 'margin-risk' ? (
        <ForexPanelShell title="Margin levels" description="Warning, margin call, and stop-out are percents. Maintenance is the ratio applied to initial margin.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-admin-muted">
              Warning %
              <Input value={form.warnLevel} onChange={(e) => setField('warnLevel', e.target.value)} className="mt-1 h-9" />
            </label>
            <label className="text-xs text-admin-muted">
              Call %
              <Input value={form.callLevel} onChange={(e) => setField('callLevel', e.target.value)} className="mt-1 h-9" />
            </label>
            <label className="text-xs text-admin-muted">
              Stop-out %
              <Input value={form.stopOut} onChange={(e) => setField('stopOut', e.target.value)} className="mt-1 h-9" />
            </label>
            <label className="text-xs text-admin-muted">
              Maintenance ratio
              <Input value={form.maintenanceRatio} onChange={(e) => setField('maintenanceRatio', e.target.value)} className="mt-1 h-9" />
            </label>
          </div>
          <ProtectedAction permission="forex:control" fallback="disabled">
            <Button type="button" size="sm" className="mt-3" disabled={patchM.isPending} onClick={() => setSaveIntent('margin')}>
              Save margin levels
            </Button>
          </ProtectedAction>
        </ForexPanelShell>
      ) : null}

      {form && mode === 'fees-swaps' ? (
        <ForexPanelShell title="Global commission">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-admin-muted">
              Model
              <select
                value={form.commModel}
                onChange={(e) => setField('commModel', e.target.value)}
                className="mt-1 h-9 w-full rounded border border-admin-border bg-admin-bg px-2 text-sm"
              >
                <option value="none">none</option>
                <option value="per_lot">per_lot</option>
                <option value="per_side">per_side</option>
                <option value="percentage">percentage</option>
              </select>
            </label>
            <label className="text-xs text-admin-muted">
              Rate
              <Input value={form.commRate} onChange={(e) => setField('commRate', e.target.value)} className="mt-1 h-9" />
            </label>
            <label className="text-xs text-admin-muted">
              Minimum
              <Input value={form.commMinimum} onChange={(e) => setField('commMinimum', e.target.value)} className="mt-1 h-9" />
            </label>
          </div>
          <ProtectedAction permission="forex:control" fallback="disabled">
            <Button type="button" size="sm" className="mt-3" disabled={patchM.isPending} onClick={() => setSaveIntent('commission')}>
              Save commission
            </Button>
          </ProtectedAction>
        </ForexPanelShell>
      ) : null}

      {form && mode === 'fees-swaps' ? (
        <ForexPanelShell title="Global swap / rollover">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-admin-muted">
              Long swap
              <Input value={form.swapLong} onChange={(e) => setField('swapLong', e.target.value)} className="mt-1 h-9" />
            </label>
            <label className="text-xs text-admin-muted">
              Short swap
              <Input value={form.swapShort} onChange={(e) => setField('swapShort', e.target.value)} className="mt-1 h-9" />
            </label>
            <label className="text-xs text-admin-muted">
              Rollover (HH:mm)
              <Input value={form.swapRoll} onChange={(e) => setField('swapRoll', e.target.value)} className="mt-1 h-9" />
            </label>
            <label className="text-xs text-admin-muted">
              Timezone
              <Input value={form.swapTz} onChange={(e) => setField('swapTz', e.target.value)} className="mt-1 h-9" />
            </label>
            <label className="text-xs text-admin-muted">
              Triple swap day
              <select
                value={form.tripleSwapDay}
                onChange={(e) => setField('tripleSwapDay', e.target.value)}
                className="mt-1 h-9 w-full rounded border border-admin-border bg-admin-bg px-2 text-sm"
              >
                {TRIPLE_SWAP_DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ProtectedAction permission="forex:control" fallback="disabled">
            <Button type="button" size="sm" className="mt-3" disabled={patchM.isPending} onClick={() => setSaveIntent('swap')}>
              Save swap policy
            </Button>
          </ProtectedAction>
        </ForexPanelShell>
      ) : null}

      {snap && mode === 'margin-risk' ? (
        <ForexPanelShell title="Instrument max leverage" noPadding>
          <div className="overflow-x-auto p-4 pt-0">
            <table className="w-full min-w-[28rem] text-xs">
              <thead>
                <tr className="border-b border-admin-border text-admin-muted">
                  <th className="py-2 text-left">Symbol</th>
                  <th className="py-2 text-left">Effective</th>
                  <th className="py-2 text-left">Catalog</th>
                  <th className="py-2 text-left">New max</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {snap.instruments.map((row) => (
                  <tr key={row.symbol} className="border-b border-admin-border/40">
                    <td className="py-2 font-medium">{row.displaySymbol}</td>
                    <td className="py-2 tabular-nums">{row.effective.maxLeverage}</td>
                    <td className="py-2 text-admin-muted tabular-nums">{row.catalog.maxLeverage}</td>
                    <td className="py-2">
                      <Input className="h-8 w-24" defaultValue={row.effective.maxLeverage} id={`lev-${row.symbol}`} />
                    </td>
                    <td className="py-2 text-right">
                      <ProtectedAction permission="forex:control" fallback="disabled">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const el = document.getElementById(`lev-${row.symbol}`) as HTMLInputElement | null;
                            const v = el?.value.trim();
                            if (!v || v === row.effective.maxLeverage) return;
                            setInstLeverage({ symbol: row.symbol, display: row.displaySymbol, value: v });
                          }}
                        >
                          Apply
                        </Button>
                      </ProtectedAction>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ForexPanelShell>
      ) : null}

      {snap && mode === 'margin-risk' ? (
        <ForexPanelShell
          title="Instrument volume"
          description="Min and max lot size. Customer orders outside this band are rejected."
          noPadding
        >
          <div className="overflow-x-auto p-4 pt-0">
            <table className="w-full min-w-[40rem] text-xs">
              <thead>
                <tr className="border-b border-admin-border text-admin-muted">
                  <th className="py-2 text-left">Symbol</th>
                  <th className="py-2 text-left">Effective</th>
                  <th className="py-2 text-left">Catalog</th>
                  <th className="py-2 text-left">New min</th>
                  <th className="py-2 text-left">New max</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {snap.instruments.map((row) => (
                  <tr key={row.symbol} className="border-b border-admin-border/40">
                    <td className="py-2 font-medium">
                      {row.displaySymbol}
                      {row.overridden ? <span className="ml-1 text-[10px] text-admin-warning">override</span> : null}
                    </td>
                    <td className="py-2 font-mono tabular-nums">
                      {row.effective.minVolume} – {row.effective.maxVolume}
                    </td>
                    <td className="py-2 font-mono text-admin-muted tabular-nums">
                      {row.catalog.minVolume} – {row.catalog.maxVolume}
                    </td>
                    <td className="py-2">
                      <Input
                        key={`${row.symbol}-min-${row.effective.minVolume}`}
                        className="h-8 w-24 font-mono"
                        defaultValue={row.effective.minVolume}
                        id={`vmin-${row.symbol}`}
                      />
                    </td>
                    <td className="py-2">
                      <Input
                        key={`${row.symbol}-max-${row.effective.maxVolume}`}
                        className="h-8 w-24 font-mono"
                        defaultValue={row.effective.maxVolume}
                        id={`vmax-${row.symbol}`}
                      />
                    </td>
                    <td className="py-2 text-right">
                      <ProtectedAction permission="forex:control" fallback="disabled">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const minEl = document.getElementById(`vmin-${row.symbol}`) as HTMLInputElement | null;
                            const maxEl = document.getElementById(`vmax-${row.symbol}`) as HTMLInputElement | null;
                            const min = positiveDecimal(minEl?.value ?? '');
                            const max = positiveDecimal(maxEl?.value ?? '');
                            if (!min || !max) {
                              setVolumeFormError('Min and max volume must be positive numbers.');
                              return;
                            }
                            if (Number(min) > Number(max)) {
                              setVolumeFormError('Min volume cannot be above max volume.');
                              return;
                            }
                            if (min === row.effective.minVolume && max === row.effective.maxVolume) {
                              setVolumeFormError(null);
                              return;
                            }
                            setVolumeFormError(null);
                            setInstVolume({ symbol: row.symbol, display: row.displaySymbol, min, max });
                          }}
                        >
                          Apply
                        </Button>
                      </ProtectedAction>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {volumeFormError ? <p className="mt-2 text-sm text-red-400">{volumeFormError}</p> : null}
          </div>
        </ForexPanelShell>
      ) : null}

      {snap?.riskLimits ? (
        <ForexPanelShell title="Risk limits" description="Effective pre-trade gates and exposure caps">
          <ForexDetailGrid
            columns={3}
            items={Object.entries(snap.riskLimits as Record<string, unknown>).map(([key, val]) => ({
              label: key.replace(/_/g, ' '),
              value:
                typeof val === 'boolean'
                  ? val
                    ? 'Yes'
                    : 'No'
                  : val === null || val === undefined
                    ? '—'
                    : typeof val === 'object'
                      ? JSON.stringify(val)
                      : String(val),
              mono: typeof val !== 'boolean' && typeof val !== 'object',
              highlight:
                key === 'tradingDisabled' && val === true
                  ? 'danger'
                  : typeof val === 'boolean' && val === false
                    ? 'success'
                    : undefined,
            }))}
          />
        </ForexPanelShell>
      ) : null}

      <ForexConfirmModal
        open={saveIntent === 'leverage'}
        onClose={() => setSaveIntent(null)}
        title="Save leverage caps"
        loading={patchM.isPending}
        onConfirm={(reason) => {
          if (form) patchWithReason({ leverage: { global_max: form.globalMaxLev, default_account: form.defaultLev } }, reason);
        }}
      />
      <ForexConfirmModal
        open={saveIntent === 'margin'}
        onClose={() => setSaveIntent(null)}
        title="Save margin levels"
        loading={patchM.isPending}
        onConfirm={(reason) => {
          if (form) {
            patchWithReason(
              {
                margin: {
                  warning_level: form.warnLevel,
                  call_level: form.callLevel,
                  stop_out_level: form.stopOut,
                  maintenance_ratio: form.maintenanceRatio,
                },
              },
              reason,
            );
          }
        }}
      />
      <ForexConfirmModal
        open={saveIntent === 'commission'}
        onClose={() => setSaveIntent(null)}
        title="Save commission policy"
        loading={patchM.isPending}
        onConfirm={(reason) => {
          if (form) {
            const rate = form.commRate.trim();
            const minimum = form.commMinimum.trim();
            patchWithReason(
              {
                commission: {
                  model: form.commModel,
                  ...(rate ? { rate } : {}),
                  ...(minimum ? { minimum } : {}),
                },
              },
              reason,
            );
          }
        }}
      />
      <ForexConfirmModal
        open={saveIntent === 'swap'}
        onClose={() => setSaveIntent(null)}
        title="Save swap policy"
        loading={patchM.isPending}
        onConfirm={(reason) => {
          if (form) {
            patchWithReason(
              {
                swap: {
                  long_swap: form.swapLong,
                  short_swap: form.swapShort,
                  rollover_time: form.swapRoll,
                  timezone: form.swapTz,
                  triple_swap_day: Number(form.tripleSwapDay),
                },
              },
              reason,
            );
          }
        }}
      />
      <ForexConfirmModal
        open={!!instLeverage}
        onClose={() => setInstLeverage(null)}
        title={`Set max leverage · ${instLeverage?.display ?? ''}`}
        description={instLeverage ? `New instrument cap: ${instLeverage.value}×` : undefined}
        loading={instM.isPending}
        onConfirm={async (reason) => {
          if (!instLeverage) return;
          await instM.mutateAsync({
            symbol: instLeverage.symbol,
            max_leverage: instLeverage.value,
            reason,
          });
        }}
      />
      <ForexConfirmModal
        open={!!instVolume}
        onClose={() => setInstVolume(null)}
        title={`Set volume · ${instVolume?.display ?? ''}`}
        description={instVolume ? `New lot band: ${instVolume.min} – ${instVolume.max}` : undefined}
        loading={volM.isPending}
        onConfirm={async (reason) => {
          if (!instVolume) return;
          await volM.mutateAsync({
            symbol: instVolume.symbol,
            min_volume: instVolume.min,
            max_volume: instVolume.max,
            reason,
          });
        }}
      />
      {instM.isError ? (
        <p className="text-sm text-red-400">{instM.error instanceof Error ? instM.error.message : 'Instrument update failed'}</p>
      ) : null}
      {volM.isError ? (
        <p className="text-sm text-red-400">{volM.error instanceof Error ? volM.error.message : 'Volume update failed'}</p>
      ) : null}
    </div>
  );
}
