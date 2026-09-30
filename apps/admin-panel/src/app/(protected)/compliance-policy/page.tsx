'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Save, Shield, Zap } from 'lucide-react';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { useAdminAuthStore } from '@/store/auth';
import { useAdminToast } from '@/components/admin-shell/AdminToast';
import { formatSaveError } from '@/lib/admin-save-feedback';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { ActionAuthModal, type ActionAuthPayload } from '@/components/ops/ActionAuthModal';
import {
  applyCompliancePreset,
  COMPLIANCE_OPERATIONS,
  getCompliancePolicy,
  patchCompliancePolicy,
  type AmlPolicyMode,
  type CompliancePolicyDocument,
  type CompliancePresetId,
  type KycPolicyMode,
} from '@/lib/compliance-policy-api';
import { cn } from '@/lib/cn';

const PRESETS: { id: CompliancePresetId; label: string; desc: string }[] = [
  { id: 'internal_qa', label: 'Internal QA', desc: 'KYC/AML off — engineering & QA' },
  { id: 'closed_beta', label: 'Closed Beta', desc: 'KYC/AML off — beta testers, full product' },
  { id: 'soft_launch', label: 'Soft Launch', desc: 'Light KYC/AML — gradual rollout' },
  { id: 'production', label: 'Production', desc: 'Full KYC + strict AML' },
];

const KYC_MODES: KycPolicyMode[] = ['disabled', 'optional', 'required'];
const AML_MODES: AmlPolicyMode[] = ['disabled', 'warn_only', 'manual_review', 'strict_blocking'];

function badgeClass(mode: string): string {
  if (mode === 'disabled') return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  if (mode === 'required' || mode === 'strict_blocking') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (mode === 'optional' || mode === 'warn_only') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
}

function opLabel(op: string): string {
  return op.replace(/_/g, ' ');
}

export default function CompliancePolicyPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const toast = useAdminToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<CompliancePolicyDocument | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<CompliancePresetId | null>(null);

  const policyQ = useQuery({
    queryKey: ['admin', 'compliance-policy', token],
    queryFn: () => getCompliancePolicy(token),
    enabled: !!token,
  });

  const policy = draft ?? (policyQ.data?.success ? policyQ.data.data : null);

  const saveMut = useMutation({
    mutationFn: (payload: ActionAuthPayload) =>
      patchCompliancePolicy(token, {
        reason: payload.reason,
        activePreset: 'custom',
        environmentLabel: policy?.environmentLabel,
        kyc: policy?.kyc,
        aml: policy?.aml,
        twofa_code: payload.twofa_code,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'compliance-policy'] });
      setDraft(null);
      toast.success('Compliance policy saved — effective immediately.');
      setAuthOpen(false);
    },
    onError: (e) => toast.error(formatSaveError(e, 'Failed to save compliance policy.')),
  });

  const presetMut = useMutation({
    mutationFn: ({ preset, payload }: { preset: CompliancePresetId; payload: ActionAuthPayload }) =>
      applyCompliancePreset(token, preset, payload.reason, payload.twofa_code),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'compliance-policy'] });
      setDraft(null);
      toast.success('Preset applied — effective immediately.');
      setAuthOpen(false);
      setPendingPreset(null);
    },
    onError: (e) => toast.error(formatSaveError(e, 'Failed to apply preset.')),
  });

  const filteredOps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COMPLIANCE_OPERATIONS;
    return COMPLIANCE_OPERATIONS.filter((op) => op.includes(q) || opLabel(op).includes(q));
  }, [search]);

  const setKyc = (op: string, mode: KycPolicyMode) => {
    if (!policy) return;
    setDraft({ ...policy, kyc: { ...policy.kyc, [op]: mode } });
  };

  const setAml = (op: string, mode: AmlPolicyMode) => {
    if (!policy) return;
    setDraft({ ...policy, aml: { ...policy.aml, [op]: mode } });
  };

  const dirty = draft !== null;

  return (
    <AdminPageFrame
      title="Compliance Policy"
      description="Runtime KYC and AML controls — changes apply immediately without restart."
      status="active"
      error={policyQ.isError ? 'Failed to load compliance policy.' : null}
      onRetry={() => void policyQ.refetch()}
      quickActions={
        <button
          type="button"
          onClick={() => void policyQ.refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-admin-border/50 px-2.5 py-1.5 text-xs text-admin-muted hover:text-admin-text"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', policyQ.isFetching && 'animate-spin')} /> Refresh
        </button>
      }
    >
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-950/10 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-200">Live runtime policy</p>
          <p className="text-xs text-amber-200/70 mt-1">
            Changing these policies affects live exchange behavior immediately. No deployment or restart required.
            Enforcement modes change immediately. KYC is only as real as the configured
            provider. If the provider is mock/manual, this is not licensed identity verification.
          </p>
        </div>
      </div>

      {policy && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-admin-border/50 bg-admin-card p-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/20 px-3 py-1 text-xs font-semibold text-emerald-300">
            <Zap className="h-3 w-3" /> Runtime active
          </span>
          <span className="text-sm text-admin-text font-medium">{policy.environmentLabel}</span>
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide', badgeClass(policy.activePreset))}>
            {policy.activePreset.replace(/_/g, ' ')}
          </span>
          {policy.updatedAt && (
            <span className="text-xs text-admin-muted ml-auto">
              Updated {new Date(policy.updatedAt).toLocaleString()} {policy.updatedBy ? `· ${policy.updatedBy.slice(0, 8)}…` : ''}
            </span>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-admin-border/50 bg-admin-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-admin-muted" />
          <p className="text-sm font-semibold text-admin-text">Environment presets</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => (
            <ProtectedAction key={p.id} permission="settings:edit" fallback="disabled">
              <button
                type="button"
                disabled={presetMut.isPending}
                onClick={() => { setPendingPreset(p.id); setAuthOpen(true); }}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors hover:border-blue-500/40',
                  policy?.activePreset === p.id ? 'border-blue-500/50 bg-blue-950/15' : 'border-admin-border/50 bg-white/[0.02]'
                )}
              >
                <p className="text-sm font-semibold text-admin-text">{p.label}</p>
                <p className="text-xs text-admin-muted mt-1">{p.desc}</p>
              </button>
            </ProtectedAction>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-admin-border/50 bg-admin-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-sm font-semibold text-admin-text">Per-operation policies</p>
          <input
            type="search"
            placeholder="Search operations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-admin-border/50 bg-white/[0.03] px-3 py-1.5 text-xs text-admin-text w-48"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border/40 text-xs uppercase text-admin-muted">
                <th className="py-2 text-left">Operation</th>
                <th className="py-2 text-left">KYC</th>
                <th className="py-2 text-left">AML</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border/30">
              {filteredOps.map((op) => (
                <tr key={op} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 capitalize text-admin-text">{opLabel(op)}</td>
                  <td className="py-2.5">
                    <ProtectedAction permission="settings:edit" fallback="disabled">
                      <select
                        value={policy?.kyc[op] ?? 'disabled'}
                        onChange={(e) => setKyc(op, e.target.value as KycPolicyMode)}
                        className="rounded-lg border border-admin-border/50 bg-white/[0.03] px-2 py-1 text-xs"
                      >
                        {KYC_MODES.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </ProtectedAction>
                  </td>
                  <td className="py-2.5">
                    <ProtectedAction permission="settings:edit" fallback="disabled">
                      <select
                        value={policy?.aml[op] ?? 'disabled'}
                        onChange={(e) => setAml(op, e.target.value as AmlPolicyMode)}
                        className="rounded-lg border border-admin-border/50 bg-white/[0.03] px-2 py-1 text-xs"
                      >
                        {AML_MODES.map((m) => (
                          <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </ProtectedAction>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {dirty && (
          <div className="mt-4 flex justify-end">
            <ProtectedAction permission="settings:edit" fallback="disabled">
              <button
                type="button"
                onClick={() => { setPendingPreset(null); setAuthOpen(true); }}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-950/20 px-4 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-950/35"
              >
                <Save className="h-3.5 w-3.5" /> Save custom policy
              </button>
            </ProtectedAction>
          </div>
        )}
      </div>

      <ActionAuthModal
        open={authOpen}
        onClose={() => { setAuthOpen(false); setPendingPreset(null); }}
        title={pendingPreset ? `Apply ${pendingPreset.replace(/_/g, ' ')} preset` : 'Save compliance policy'}
        actionLabel={pendingPreset ? `Apply ${pendingPreset} preset` : 'Update compliance policy'}
        description="Reason is recorded in the audit log with your session and IP."
        isPending={saveMut.isPending || presetMut.isPending}
        onConfirm={async (payload) => {
          if (pendingPreset) {
            await presetMut.mutateAsync({ preset: pendingPreset, payload });
          } else {
            await saveMut.mutateAsync(payload);
          }
        }}
      />
    </AdminPageFrame>
  );
}
