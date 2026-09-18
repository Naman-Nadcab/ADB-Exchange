'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { adminFetch } from '@/lib/api';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexConfirmModal } from '@/components/forex/primitives/ForexConfirmModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type CaseRow = {
  case_id: string;
  subject_type: string;
  subject_id: string;
  case_type: string;
  status: string;
  summary: string;
  created_at: string;
};

type PendingTransition = { caseId: string; status: string; summary: string };

export function ForexCompliancePanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [subjectId, setSubjectId] = useState('');
  const [summary, setSummary] = useState('');
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['admin', 'forex', 'compliance', token],
    queryFn: async () => {
      const res = await adminFetch<{ rows: CaseRow[]; provider_status: string; note: string }>('/forex/compliance/cases', {
        token,
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
  });

  const createM = useMutation({
    mutationFn: async () => {
      const res = await adminFetch('/forex/compliance/cases', {
        token,
        method: 'POST',
        body: { subject_type: 'ACCOUNT', subject_id: subjectId.trim(), case_type: 'MANUAL_REVIEW', summary: summary.trim() },
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Create failed');
    },
    onSuccess: () => {
      setSummary('');
      qc.invalidateQueries({ queryKey: ['admin', 'forex', 'compliance'] });
    },
  });

  const transitionM = useMutation({
    mutationFn: async ({ caseId, status, note }: { caseId: string; status: string; note: string }) => {
      const res = await adminFetch(`/forex/compliance/cases/${caseId}/status`, {
        token,
        method: 'PATCH',
        body: { status, note },
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Transition failed');
    },
    onSuccess: () => {
      setPendingTransition(null);
      setTransitionError(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'compliance'] });
    },
    onError: (err) => {
      setTransitionError(err instanceof Error ? err.message : 'Transition failed');
    },
  });

  return (
    <div className="admin-stack-lg">
      <ForexConfirmModal
        open={!!pendingTransition}
        onClose={() => {
          setPendingTransition(null);
          setTransitionError(null);
        }}
        title={pendingTransition ? `Case → ${pendingTransition.status}` : 'Case transition'}
        description={
          pendingTransition
            ? `${pendingTransition.summary.slice(0, 120)}${pendingTransition.summary.length > 120 ? '…' : ''}`
            : undefined
        }
        confirmLabel="Apply transition"
        dangerous={pendingTransition?.status === 'ESCALATED'}
        loading={transitionM.isPending}
        onConfirm={async (note) => {
          if (!pendingTransition) return;
          await transitionM.mutateAsync({
            caseId: pendingTransition.caseId,
            status: pendingTransition.status,
            note,
          });
        }}
      />
      {transitionError ? <p className="text-xs text-red-400">{transitionError}</p> : null}
      <ForexPanelShell title="Compliance cases" description={q.data?.note ?? 'Manual review workflow.'}>
        <p className="mb-3 text-xs text-amber-200/90">
          Provider status: <strong>{q.data?.provider_status ?? 'NOT_CONNECTED'}</strong> — never shown as PASS without a configured provider.
        </p>
        {q.isLoading ? (
          <p className="text-sm text-admin-muted">Loading cases…</p>
        ) : (
          <ul className="admin-stack-sm">
            {(q.data?.rows ?? []).map((c) => (
              <li key={c.case_id} className="rounded-lg border border-admin-border/60 p-3 text-sm">
                <span className="font-mono text-xs">{c.case_id.slice(0, 8)}…</span> · {c.case_type} · {c.status}
                <p className="text-admin-muted">{c.summary}</p>
                {c.status !== 'CLOSED' ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(['IN_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED'] as const).map((st) => (
                      <Button
                        key={st}
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[10px]"
                        onClick={() =>
                          setPendingTransition({ caseId: c.case_id, status: st, summary: c.summary || c.case_type })
                        }
                      >
                        → {st}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ForexPanelShell>
      <ForexPanelShell title="Open case" description="Requires forex:compliance:manage and audit trail.">
        <div className="grid max-w-md gap-2">
          <Input placeholder="Account / subject id" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} />
          <Input placeholder="Summary (min 8 chars)" value={summary} onChange={(e) => setSummary(e.target.value)} />
          <Button
            size="sm"
            disabled={createM.isPending || subjectId.trim().length < 3 || summary.trim().length < 8}
            onClick={() => createM.mutate()}
          >
            Create case
          </Button>
          {createM.isError ? <p className="text-xs text-red-400">{createM.error instanceof Error ? createM.error.message : 'Failed'}</p> : null}
        </div>
      </ForexPanelShell>
    </div>
  );
}
