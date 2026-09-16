'use client';

import { ForexAdminShell } from '@/components/forex/ForexAdminShell';

export default function ForexAdminLayout({ children }: { children: React.ReactNode }) {
  return <ForexAdminShell>{children}</ForexAdminShell>;
}
