'use client';

import { useParams } from 'next/navigation';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { ForexCrmFinanceAccountPanel } from '@/components/forex/panels/ForexCrmFinanceAccountPanel';

export default function ForexCrmFinanceAccountPage() {
  const params = useParams();
  const accountId = typeof params.accountId === 'string' ? params.accountId : '';

  return (
    <AdminPageFrame title="Forex finance" description="Ledger & reconciliation · CRM">
      {accountId ? (
        <ForexCrmFinanceAccountPanel accountId={accountId} />
      ) : (
        <p className="text-sm text-admin-muted">Missing account id.</p>
      )}
    </AdminPageFrame>
  );
}
