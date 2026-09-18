'use client';

import { ForexPostureBanner } from '@/components/forex/ForexPostureBanner';

/** Forex layout shell — posture only. Navigation lives in UnifiedSidebar; hierarchy in topbar breadcrumbs. */
export function ForexAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-stack-lg w-full max-w-none">
      <ForexPostureBanner />
      {children}
    </div>
  );
}
