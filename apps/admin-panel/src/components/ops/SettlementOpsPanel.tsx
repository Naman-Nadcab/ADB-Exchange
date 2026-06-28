'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { OperatorSection } from '@/components/admin-shell/OperatorSection';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { ActionAuthModal, type ActionAuthPayload } from '@/components/ops/ActionAuthModal';
import {
  listSettlementEvents,
  getSettlementLedgerDiscrepancy,
  postSettlementCircuitReset,
} from '@/lib/settlement-api';

export function SettlementOpsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);

  const eventsQ = useQuery({
    queryKey: ['admin', 'settlement-events', token],
    queryFn: () => listSettlementEvents(token, { limit: 20 }),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const discQ = useQuery({
    queryKey: ['admin', 'settlement-ledger-disc', token],
    queryFn: () => getSettlementLedgerDiscrepancy(token),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const resetMut = useMutation({
    mutationFn: (payload: ActionAuthPayload) =>
      postSettlementCircuitReset(token, { confirm: true, reason: payload.reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settlement-events'] });
      setResetOpen(false);
    },
  });

  const events = (eventsQ.data?.data as { events?: Array<Record<string, unknown>> } | undefined)?.events
    ?? (eventsQ.data?.data as Array<Record<string, unknown>> | undefined)
    ?? [];
  const eventList = Array.isArray(events) ? events : [];
  const disc = discQ.data?.data as Record<string, unknown> | undefined;

  return (
    <>
      <OperatorSection
        title="Settlement operations"
        description="Monitor settlement event queue and ledger integrity. Use circuit reset only when settlement is stuck after an incident."
        help="Settlement events move balances after trades. Ledger discrepancy compares settlement ledger to balance ledger."
        helpDanger="Circuit reset clears settlement halt flags — confirm no active trades are mid-settlement."
        auditHref="/audit"
        lastUpdated={eventsQ.dataUpdatedAt ? new Date(eventsQ.dataUpdatedAt).toLocaleString() : null}
        actions={
          <ProtectedAction permission="control:commands" fallback="disabled">
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(true)}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset circuit
            </Button>
          </ProtectedAction>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-admin-border/50 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-wide text-admin-muted">Recent events</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{eventList.length}</p>
          </div>
          <div className="rounded-lg border border-admin-border/50 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-wide text-admin-muted">Discrepancy check</p>
            <p className="mt-1 text-lg font-semibold">
              {discQ.isLoading ? '…' : discQ.isError ? 'Error' : 'Loaded'}
            </p>
          </div>
          <div className="rounded-lg border border-admin-border/50 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-wide text-admin-muted">Diagnostics</p>
            <Link href="/monitoring" className="mt-1 inline-block text-xs text-admin-accent hover:underline">
              Open monitoring →
            </Link>
          </div>
        </div>

        {discQ.isError ? (
          <p className="mb-3 flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Ledger discrepancy report unavailable.
          </p>
        ) : disc && typeof disc === 'object' ? (
          <pre className="mb-4 max-h-32 overflow-auto rounded-lg border border-admin-border/40 bg-black/20 p-2 text-[10px] text-admin-muted">
            {JSON.stringify(disc, null, 2)}
          </pre>
        ) : null}

        {eventsQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-admin-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading settlement events…
          </div>
        ) : eventList.length === 0 ? (
          <p className="text-sm text-admin-muted">No settlement events in the current window.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-admin-border/50">
            <table className="w-full text-xs">
              <thead className="border-b border-admin-border/50 bg-white/[0.02] text-admin-muted">
                <tr>
                  {['ID', 'Status', 'Created'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eventList.slice(0, 15).map((row, i) => (
                  <tr key={String(row.id ?? i)} className="border-t border-admin-border/30">
                    <td className="px-3 py-2 font-mono">{String(row.id ?? '—')}</td>
                    <td className="px-3 py-2">
                      <Badge variant={row.status === 'completed' ? 'success' : 'default'} size="sm">
                        {String(row.status ?? 'unknown')}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-admin-muted">{String(row.created_at ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OperatorSection>

      <ActionAuthModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset settlement circuit"
        actionLabel="Reset settlement circuit"
        description="Clears settlement circuit halt and trading halt flags. Document the incident before proceeding."
        confirmationPhrase="RESET SETTLEMENT"
        onConfirm={(payload) => { void resetMut.mutateAsync(payload); }}
        isPending={resetMut.isPending}
        requireReason
        twofaRequired
        confirmVariant="danger"
      />
    </>
  );
}
