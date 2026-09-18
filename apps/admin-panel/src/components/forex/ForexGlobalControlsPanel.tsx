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
import { SafeActionModal } from '@/components/ui/SafeActionModal';
import { ForexConfirmModal } from '@/components/forex/primitives/ForexConfirmModal';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  extractForexApprovalPending,
  ForexApprovalPendingNotice,
  type ForexApprovalPendingInfo,
} from '@/components/forex/primitives/ForexApprovalPendingNotice';

type BoolKey = 'kill_switch' | 'demo_funding' | 'funding_test_api' | 'execution_test_api';

const BOOL_META: Record<
  BoolKey,
  { label: string; description: string; dangerous?: boolean; snapEffective: (s: ForexAdminControlsSnapshot) => boolean; snapEnv: (s: ForexAdminControlsSnapshot) => boolean }
> = {
  kill_switch: {
    label: 'Global kill switch',
    description: 'Reject new Forex orders platform-wide (mock venue).',
    dangerous: true,
    snapEffective: (s) => s.effective.killSwitch,
    snapEnv: (s) => s.envBaseline.killSwitch,
  },
  demo_funding: {
    label: 'Demo funding',
    description: 'Allow customer demo ledger credits (Forex ledger only).',
    snapEffective: (s) => s.effective.demoFundingEnabled,
    snapEnv: (s) => s.envBaseline.demoFundingEnabled,
  },
  funding_test_api: {
    label: 'Funding test API',
    description: 'Ops simulated header for funding test routes.',
    snapEffective: (s) => s.effective.fundingTestApiEnabled,
    snapEnv: (s) => s.envBaseline.fundingTestApiEnabled,
  },
  execution_test_api: {
    label: 'Execution test API',
    description: 'Simulated test execution endpoint gate.',
    snapEffective: (s) => s.effective.executionTestApiEnabled,
    snapEnv: (s) => s.envBaseline.executionTestApiEnabled,
  },
};

function FlagRow(props: {
  label: string;
  description: string;
  effective: boolean;
  env: boolean;
  dangerous?: boolean;
  onRequestToggle: () => void;
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
      <ProtectedAction permission="forex:control" fallback="disabled">
        <Button
          type="button"
          size="sm"
          variant={props.dangerous ? 'danger' : 'secondary'}
          disabled={props.pending}
          onClick={props.onRequestToggle}
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
  const [pendingBool, setPendingBool] = useState<{ key: BoolKey; next: boolean } | null>(null);
  const [killSwitchArm, setKillSwitchArm] = useState(false);
  const [instStatus, setInstStatus] = useState<{ symbol: string; display: string; status: string } | null>(null);
  const [approvalNotice, setApprovalNotice] = useState<ForexApprovalPendingInfo | null>(null);

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
      if (!res.success) throw new Error(res.error?.message ?? 'Update failed');
      return res;
    },
    onSuccess: (res) => {
      const pending = extractForexApprovalPending(res.data, res.meta?.httpStatus);
      setApprovalNotice(pending);
      if (!pending) void qc.invalidateQueries({ queryKey: ['admin', 'forex'] });
      setPendingBool(null);
      setKillSwitchArm(false);
    },
  });

  const instrumentM = useMutation({
    mutationFn: async (args: { symbol: string; trading_status: string; reason: string }) => {
      const res = await patchForexInstrumentTradingStatus(token, args.symbol, {
        trading_status: args.trading_status,
        reason: args.reason,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Instrument update failed');
      return res;
    },
    onSuccess: (res) => {
      const pending = extractForexApprovalPending(res.data, res.meta?.httpStatus);
      setApprovalNotice(pending);
      if (!pending) void qc.invalidateQueries({ queryKey: ['admin', 'forex'] });
      setInstStatus(null);
    },
  });

  const snap = controlsQ.data;

  const requestBoolToggle = (key: BoolKey, next: boolean) => {
    if (key === 'kill_switch' && next) {
      setKillSwitchArm(true);
      return;
    }
    setPendingBool({ key, next });
  };

  return (
    <div className="space-y-4">
      <ForexApprovalPendingNotice info={approvalNotice} onDismiss={() => setApprovalNotice(null)} />
      <ForexPanelShell
        title="Global runtime controls"
        description="In-process overrides until backend restart · audit-logged · control:trading required"
        actions={
          <Button type="button" variant="ghost" size="sm" onClick={() => void controlsQ.refetch()}>
            <RefreshCw className={`h-3.5 w-3.5 ${controlsQ.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        }
      >
        {snap ? (
          <div className="space-y-3">
            {(Object.keys(BOOL_META) as BoolKey[]).map((key) => {
              const meta = BOOL_META[key];
              return (
                <FlagRow
                  key={key}
                  label={meta.label}
                  description={meta.description}
                  dangerous={meta.dangerous}
                  effective={meta.snapEffective(snap)}
                  env={meta.snapEnv(snap)}
                  pending={patchM.isPending}
                  onRequestToggle={() => requestBoolToggle(key, !meta.snapEffective(snap))}
                />
              );
            })}
            <div className="rounded-lg border border-admin-border/60 bg-admin-bg/30 p-3 text-xs text-admin-muted">
              Economic ready:{' '}
              <strong className={snap.readiness.economicReady ? 'text-emerald-400' : 'text-amber-400'}>
                {snap.readiness.economicReady ? 'Yes' : 'No'}
              </strong>
              {snap.readiness.reason ? ` — ${snap.readiness.reason}` : null}
            </div>
          </div>
        ) : controlsQ.isLoading ? (
          <p className="text-sm text-admin-muted">Loading controls…</p>
        ) : null}
        {patchM.isError ? (
          <p className="mt-2 flex items-center gap-1 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4" />
            {patchM.error instanceof Error ? patchM.error.message : 'Update failed'}
          </p>
        ) : null}
      </ForexPanelShell>

      {snap ? (
        <ForexPanelShell title="Per-instrument trading status" description="Halt or reopen symbols without redeploy" noPadding>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead>
                <tr className="border-b border-admin-border text-admin-muted">
                  <th className="py-2 pr-2">Symbol</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Override</th>
                  <th className="py-2 text-right">Set status</th>
                </tr>
              </thead>
              <tbody>
                {snap.instruments.map((row) => (
                  <tr key={row.symbol} className="border-b border-admin-border/50">
                    <td className="py-2 pr-2 font-medium">{row.displaySymbol}</td>
                    <td className="py-2 pr-2">
                      <Badge
                        variant={row.tradingStatus === 'active' ? 'success' : row.tradingStatus === 'halted' ? 'danger' : 'warning'}
                        className="font-normal capitalize"
                      >
                        {row.tradingStatus}
                      </Badge>
                    </td>
                    <td className="py-2 pr-2 text-admin-muted">{row.overridden ? 'Yes' : 'No'}</td>
                    <td className="py-2 text-right">
                      <ProtectedAction permission="forex:control" fallback="disabled">
                        <div className="flex justify-end gap-1">
                          {(['active', 'halted', 'closed'] as const).map((st) => (
                            <Button
                              key={st}
                              type="button"
                              size="sm"
                              variant={row.tradingStatus === st ? 'primary' : 'outline'}
                              className="h-7 px-2 text-[10px] capitalize"
                              disabled={row.tradingStatus === st || instrumentM.isPending}
                              onClick={() =>
                                setInstStatus({ symbol: row.symbol, display: row.displaySymbol, status: st })
                              }
                            >
                              {st}
                            </Button>
                          ))}
                        </div>
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
          </div>
        </ForexPanelShell>
      ) : null}

      <SafeActionModal
        open={killSwitchArm}
        onClose={() => setKillSwitchArm(false)}
        title="Enable global kill switch"
        description="All new Forex customer orders will be rejected until the kill switch is turned off."
        impactWarning="This is a platform-wide trading halt for the Forex module. Confirm only during an incident or scheduled maintenance."
        severity="destructive"
        confirmWord="HALT"
        confirmLabel="Enable kill switch"
        requiredPermission="forex:control"
        onConfirm={async () => {
          await patchM.mutateAsync({ kill_switch: true, reason: 'Kill switch enabled via admin safe action' });
        }}
      />

      <ForexConfirmModal
        open={!!pendingBool}
        onClose={() => setPendingBool(null)}
        title={pendingBool ? `${BOOL_META[pendingBool.key].label}: turn ${pendingBool.next ? 'ON' : 'OFF'}` : 'Confirm'}
        description={pendingBool ? BOOL_META[pendingBool.key].description : undefined}
        dangerous={pendingBool?.key === 'kill_switch' && pendingBool.next}
        loading={patchM.isPending}
        onConfirm={async (reason) => {
          if (!pendingBool) return;
          await patchM.mutateAsync({ reason, [pendingBool.key]: pendingBool.next });
        }}
      />

      <ForexConfirmModal
        open={!!instStatus}
        onClose={() => setInstStatus(null)}
        title={`${instStatus?.display ?? 'Symbol'} → ${instStatus?.status ?? ''}`}
        dangerous={instStatus?.status === 'halted'}
        loading={instrumentM.isPending}
        onConfirm={async (reason) => {
          if (!instStatus) return;
          await instrumentM.mutateAsync({
            symbol: instStatus.symbol,
            trading_status: instStatus.status,
            reason,
          });
        }}
      />
    </div>
  );
}
