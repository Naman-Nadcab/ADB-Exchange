'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';

export type ForexApprovalPendingInfo = {
  approval_id: string;
  status?: string;
  correlationId?: string;
  note?: string;
};

export function ForexApprovalPendingNotice(props: { info: ForexApprovalPendingInfo | null; onDismiss?: () => void }) {
  if (!props.info) return null;
  return (
    <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning" className="font-normal">
          Submitted for approval
        </Badge>
        <span className="text-xs text-amber-200/90">
          Change is <strong>not live</strong> until approvers complete maker-checker.
        </span>
      </div>
      <dl className="mt-2 grid gap-1 text-xs font-mono text-amber-100/90">
        <div>
          <span className="text-amber-200/70">Approval ID:</span> {props.info.approval_id}
        </div>
        {props.info.status ? (
          <div>
            <span className="text-amber-200/70">Status:</span> {props.info.status}
          </div>
        ) : null}
        {props.info.correlationId ? (
          <div>
            <span className="text-amber-200/70">Correlation:</span> {props.info.correlationId}
          </div>
        ) : null}
      </dl>
      {props.info.note ? <p className="mt-2 text-xs text-amber-200/80">{props.info.note}</p> : null}
      <Link href="/approvals" className="mt-2 inline-block text-xs font-medium text-amber-50 underline hover:no-underline">
        Open approvals queue
      </Link>
      {props.onDismiss ? (
        <button type="button" className="ml-4 text-xs text-amber-200/70 underline" onClick={props.onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

export function extractForexApprovalPending(data: unknown, httpStatus?: number): ForexApprovalPendingInfo | null {
  if (httpStatus !== 202 || !data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!d.approval_required || !d.approval_id) return null;
  return {
    approval_id: String(d.approval_id),
    status: d.status != null ? String(d.status) : 'pending',
    correlationId: d.correlationId != null ? String(d.correlationId) : undefined,
    note: d.note != null ? String(d.note) : undefined,
  };
}
