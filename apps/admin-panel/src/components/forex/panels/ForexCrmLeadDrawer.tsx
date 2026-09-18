'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ForexCrmLeadDetailPanel } from '@/components/forex/panels/ForexCrmLeadDetailPanel';

export function ForexCrmLeadDrawer(props: { leadId: string | null; onClose: () => void }) {
  if (!props.leadId) return null;

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/40 lg:bg-black/30" aria-label="Close lead detail" onClick={props.onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-admin-border bg-admin-bg shadow-xl">
        <div className="flex items-center justify-between border-b border-admin-border px-4 py-3">
          <p className="text-sm font-semibold">Lead detail</p>
          <Button type="button" variant="ghost" size="sm" onClick={props.onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <ForexCrmLeadDetailPanel leadId={props.leadId} />
        </div>
      </div>
    </>
  );
}
