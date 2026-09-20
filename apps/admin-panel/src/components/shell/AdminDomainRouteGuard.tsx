'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuthStore } from '@/store/auth';
import {
  canAccessAdminPath,
  defaultLandingForAdmin,
} from '@/lib/admin/admin-domain';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

/**
 * Client-side domain guard — complements backend RBAC.
 * Redirects unauthorized cross-domain deep links to an allowed landing.
 */
export function AdminDomainRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const admin = useAdminAuthStore((s) => s.admin);
  const role = admin?.role;
  const permissions = admin?.permissions;

  const allowed = canAccessAdminPath(role, permissions, pathname);
  const landing = defaultLandingForAdmin(role, permissions);

  useEffect(() => {
    if (!admin) return;
    if (!allowed && pathname !== landing) {
      router.replace(landing);
    }
  }, [admin, allowed, landing, pathname, router]);

  if (!admin) return <>{children}</>;

  if (!allowed) {
    if (pathname !== landing) {
      return <PageSkeleton />;
    }
    return (
      <AdminPageFrame title="Access restricted" description="You do not have permission to view this workspace area.">
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <ShieldAlert className="h-10 w-10 text-admin-warning" aria-hidden />
          <p className="text-sm text-admin-muted max-w-md">
            This page belongs to a domain your role cannot access. Backend APIs will also deny unauthorized actions.
          </p>
          <Link
            href={landing}
            className="rounded-lg border border-admin-border bg-admin-primary/10 px-4 py-2 text-sm font-medium text-admin-primary hover:bg-admin-primary/15"
          >
            Go to {landing === '/control-center' ? 'Control Center' : 'home'}
          </Link>
        </div>
      </AdminPageFrame>
    );
  }

  return <>{children}</>;
}
