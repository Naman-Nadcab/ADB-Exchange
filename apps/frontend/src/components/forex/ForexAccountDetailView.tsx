'use client';

import { ForexAccountManagementHub } from './ForexAccountManagementHub';

/** Account detail route — CXM-style management hub. */
export function ForexAccountDetailView({ accountId }: { accountId: string }) {
  return <ForexAccountManagementHub accountId={accountId} />;
}
