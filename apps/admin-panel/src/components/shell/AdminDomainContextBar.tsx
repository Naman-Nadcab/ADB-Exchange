'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ADMIN_DOMAIN_LABELS,
  ADMIN_DOMAIN_LANDING,
  adminDomainContextTitle,
  canAccessAdminDomain,
  pathnameToAdminDomain,
  visibleAdminDomains,
  type AdminDomain,
} from '@/lib/admin/admin-domain';
import { useAdminAuthStore } from '@/store/auth';
import { cn } from '@/lib/cn';

export function AdminDomainContextBar() {
  const pathname = usePathname() ?? '';
  const admin = useAdminAuthStore((s) => s.admin);
  const role = admin?.role;
  const permissions = admin?.permissions;

  const activeDomain = pathnameToAdminDomain(pathname);
  const domains = visibleAdminDomains(role, permissions);

  if (domains.length <= 1) {
    return (
      <div
        className="border-b border-admin-border bg-admin-surface/80 px-3 sm:px-5 py-2"
        role="region"
        aria-label="Admin workspace context"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-admin-muted">
          {adminDomainContextTitle(activeDomain)}
        </p>
      </div>
    );
  }

  return (
    <div
      className="border-b border-admin-border bg-admin-surface/80 px-3 sm:px-5 py-2"
      role="navigation"
      aria-label="Admin workspace"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-admin-muted hidden sm:block">
          {adminDomainContextTitle(activeDomain)}
        </p>
        <div
          className="flex flex-wrap gap-1 rounded-lg border border-admin-border bg-admin-bg/60 p-0.5"
          role="tablist"
          aria-label="Switch admin workspace"
        >
          {domains.map((domain) => (
            <DomainTab
              key={domain}
              domain={domain}
              active={activeDomain === domain}
              enabled={canAccessAdminDomain(role, permissions, domain)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DomainTab({
  domain,
  active,
  enabled,
}: {
  domain: AdminDomain;
  active: boolean;
  enabled: boolean;
}) {
  const label = ADMIN_DOMAIN_LABELS[domain];
  const href = ADMIN_DOMAIN_LANDING[domain];

  if (!enabled) return null;

  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-primary/50',
        active
          ? 'bg-admin-primary/15 text-admin-primary border border-admin-primary/25'
          : 'text-admin-muted hover:bg-white/5 hover:text-admin-text border border-transparent',
      )}
    >
      {label}
    </Link>
  );
}
