'use client';

import { useParams } from 'next/navigation';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { ForexCrmClientDetailPanel } from '@/components/forex/panels/ForexCrmClientDetailPanel';

export default function ForexCrmClientDetailPage() {
  const params = useParams();
  const accountId = typeof params.accountId === 'string' ? params.accountId : '';

  return (
    <AdminPageFrame title="Forex client" description="Account detail · CRM">
      {accountId ? (
        <ForexCrmClientDetailPanel accountId={accountId} />
      ) : (
        <p className="text-sm text-admin-muted">Missing account id.</p>
      )}
    </AdminPageFrame>
  );
}
