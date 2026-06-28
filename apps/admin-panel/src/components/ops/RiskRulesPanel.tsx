'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Shield } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { adminFetch } from '@/lib/api';
import { OperatorSection } from '@/components/admin-shell/OperatorSection';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';

interface RiskRule {
  id: string;
  name?: string;
  scope?: string;
  decision?: string;
  enabled?: boolean;
  min_score?: number;
  description?: string;
}

export function RiskRulesPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', scope: 'withdrawal', decision: 'challenge', min_score: '50' });

  const rulesQ = useQuery({
    queryKey: ['admin', 'security', 'risk-rules', token],
    queryFn: () =>
      adminFetch<{ rules: RiskRule[]; total: number }>('/security/risk-rules', {
        token,
        params: { limit: 50 },
      }),
    enabled: !!token,
  });

  const createMut = useMutation({
    mutationFn: () =>
      adminFetch('/security/risk-rules', {
        method: 'POST',
        token,
        body: {
          name: form.name.trim() || 'New rule',
          scope: form.scope,
          decision: form.decision,
          min_score: Number(form.min_score) || 0,
          enabled: true,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'security', 'risk-rules'] });
      setShowCreate(false);
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enable }: { id: string; enable: boolean }) =>
      adminFetch(`/security/risk-rules/${id}/${enable ? 'enable' : 'disable'}`, {
        method: 'PATCH',
        token,
        body: {},
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'security', 'risk-rules'] }),
  });

  const rules = rulesQ.data?.data?.rules ?? [];

  return (
    <OperatorSection
      title="Risk engine rules"
      description="Configurable rules evaluated at login, withdrawal, P2P, API, and admin actions."
      help="Rules return allow, challenge (step-up), or block based on risk score thresholds."
      helpDanger="Disabling all withdrawal rules increases fraud exposure."
      auditHref="/audit"
      actions={
        <ProtectedAction permission="settings:edit" fallback="hidden">
          <Button variant="ghost" size="sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add rule
          </Button>
        </ProtectedAction>
      }
    >
      {showCreate && (
        <div className="mb-4 grid gap-2 rounded-lg border border-admin-border/50 bg-white/[0.02] p-3 sm:grid-cols-4">
          <input className="rounded border border-admin-border bg-admin-surface px-2 py-1.5 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <select className="rounded border border-admin-border bg-admin-surface px-2 py-1.5 text-sm" value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}>
            {['login', 'withdrawal', 'p2p', 'api', 'admin'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="rounded border border-admin-border bg-admin-surface px-2 py-1.5 text-sm" value={form.decision} onChange={(e) => setForm((f) => ({ ...f, decision: e.target.value }))}>
            {['allow', 'challenge', 'block'].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <Button size="sm" onClick={() => createMut.mutate()} disabled={createMut.isPending}>Create</Button>
        </div>
      )}
      {rulesQ.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-admin-muted" />
      ) : rules.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-admin-muted"><Shield className="h-4 w-4" /> No risk rules configured.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-admin-muted">
              <tr>
                {['Name', 'Scope', 'Decision', 'Min score', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="pb-2 pr-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-admin-border/30">
                  <td className="py-2 pr-3">{r.name ?? r.id.slice(0, 8)}</td>
                  <td className="py-2 pr-3">{r.scope ?? '—'}</td>
                  <td className="py-2 pr-3">{r.decision ?? '—'}</td>
                  <td className="py-2 pr-3 font-mono">{r.min_score ?? '—'}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={r.enabled !== false ? 'success' : 'default'} size="sm">{r.enabled !== false ? 'On' : 'Off'}</Badge>
                  </td>
                  <td className="py-2">
                    <ProtectedAction permission="settings:edit" fallback="disabled">
                      <button type="button" className="text-admin-accent hover:underline" onClick={() => toggleMut.mutate({ id: r.id, enable: r.enabled === false })}>
                        {r.enabled === false ? 'Enable' : 'Disable'}
                      </button>
                    </ProtectedAction>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OperatorSection>
  );
}
