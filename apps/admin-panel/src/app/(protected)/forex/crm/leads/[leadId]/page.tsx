'use client';

import { useParams } from 'next/navigation';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { ForexCrmLeadDetailPanel } from '@/components/forex/panels/ForexCrmLeadDetailPanel';

export default function ForexCrmLeadDetailPage() {
  const params = useParams();
  const leadId = typeof params.leadId === 'string' ? params.leadId : '';

  return (
    <AdminPageFrame title="Forex lead" description="Lead detail · CRM">
      {leadId ? <ForexCrmLeadDetailPanel leadId={leadId} /> : <p className="text-sm text-admin-muted">Missing lead id.</p>}
    </AdminPageFrame>
  );
}
