'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { OperatorSection } from '@/components/admin-shell/OperatorSection';
import { Button } from '@/components/ui/Button';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { ActionAuthModal, type ActionAuthPayload } from '@/components/ops/ActionAuthModal';
import { useAdminToast } from '@/components/admin-shell/AdminToast';
import { formatSaveError } from '@/lib/admin-save-feedback';
import { useState } from 'react';
import {
  getDepositSweepEligibility,
  listDepositSweeps,
  runDepositSweeps,
} from '@/lib/settlement-api';

export function DepositSweepsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const toast = useAdminToast();
  const [runOpen, setRunOpen] = useState(false);

  const eligQ = useQuery({
    queryKey: ['admin', 'deposit-sweeps-elig', token],
    queryFn: () => getDepositSweepEligibility(token),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const sweepsQ = useQuery({
    queryKey: ['admin', 'deposit-sweeps', token],
    queryFn: () => listDepositSweeps(token, { limit: 10 }),
    enabled: !!token,
  });

  const runMut = useMutation({
    mutationFn: (payload: ActionAuthPayload) =>
      runDepositSweeps(token, { reason: payload.reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'deposit-sweeps'] });
      setRunOpen(false);
      toast.success('Deposit sweep started.');
    },
    onError: (e) => toast.error(formatSaveError(e, 'Deposit sweep failed.')),
  });

  const sweeps = (sweepsQ.data?.data as { sweeps?: unknown[] } | undefined)?.sweeps ?? [];

  return (
    <>
      <OperatorSection
        title="Deposit sweeps"
        description="Move accumulated deposit funds from hot addresses to treasury targets."
        help="Sweep runs consolidate on-chain deposits. Check eligibility before triggering a manual run."
        helpDanger="On-chain fees apply. Verify treasury hot wallet gas before running."
        auditHref="/audit"
        actions={
          <ProtectedAction permission="treasury:sweep" fallback="disabled">
            <Button size="sm" onClick={() => setRunOpen(true)}>
              <Play className="mr-1 h-3.5 w-3.5" /> Run sweep
            </Button>
          </ProtectedAction>
        }
      >
        {eligQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-admin-muted"><Loader2 className="h-4 w-4 animate-spin" /> Checking eligibility…</div>
        ) : (
          <pre className="mb-3 max-h-24 overflow-auto rounded border border-admin-border/40 bg-black/20 p-2 text-[10px] text-admin-muted">
            {JSON.stringify(eligQ.data?.data ?? {}, null, 2)}
          </pre>
        )}
        {Array.isArray(sweeps) && sweeps.length > 0 ? (
          <pre className="max-h-40 overflow-auto rounded border border-admin-border/40 bg-black/20 p-2 text-[10px] text-admin-muted">
            {JSON.stringify(sweeps.slice(0, 5), null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-admin-muted">No recent sweep runs recorded.</p>
        )}
      </OperatorSection>

      <ActionAuthModal
        open={runOpen}
        onClose={() => setRunOpen(false)}
        title="Run deposit sweep"
        actionLabel="Run deposit sweep"
        description="Triggers a manual deposit sweep job. Funds move on-chain — irreversible."
        confirmationPhrase="RUN SWEEP"
        onConfirm={(p) => { void runMut.mutateAsync(p); }}
        isPending={runMut.isPending}
        requireReason
        twofaRequired
        confirmVariant="danger"
      />
    </>
  );
}
