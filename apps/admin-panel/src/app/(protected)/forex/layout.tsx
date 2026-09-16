import { ForexAdminShell } from '@/components/forex/ForexAdminShell';

/** Auth-gated ops UI — avoid static prerender/timeouts during `next build`. */
export const dynamic = 'force-dynamic';

export default function ForexAdminLayout({ children }: { children: React.ReactNode }) {
  return <ForexAdminShell>{children}</ForexAdminShell>;
}
