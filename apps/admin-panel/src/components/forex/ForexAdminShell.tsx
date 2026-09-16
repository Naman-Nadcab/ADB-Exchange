'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FOREX_ADMIN_ROUTES, forexRouteByHref } from '@/lib/admin/forex-admin-nav';
import { ForexPostureBanner } from '@/components/forex/ForexPostureBanner';
import { cn } from '@/lib/cn';

export function ForexAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/forex';
  const active = forexRouteByHref(pathname);

  return (
    <div className="admin-stack-lg">
      <ForexPostureBanner />

      <nav
        aria-label="Forex admin sections"
        className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto border-b border-admin-border pb-0.5"
      >
        {FOREX_ADMIN_ROUTES.map((route) => {
          const isActive =
            route.href === '/forex'
              ? pathname === '/forex'
              : pathname === route.href || pathname.startsWith(route.href + '/');
          const Icon = route.icon;
          return (
            <Link
              key={route.id}
              href={route.href}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                  : 'border-transparent text-admin-muted hover:bg-admin-card hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {route.label}
              <span className="rounded bg-admin-bg px-1 py-0.5 text-[9px] uppercase text-admin-muted">{route.phase}</span>
            </Link>
          );
        })}
      </nav>

      {active && pathname !== active.href ? null : (
        <p className="text-xs text-admin-muted">
          {active?.description ?? 'Forex FDM administration'}
        </p>
      )}

      {children}
    </div>
  );
}
