'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, PanelLeftClose, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSidebarState } from './SidebarContext';
import { buildSidebarSections, isSidebarNavActive } from '@/lib/admin/nav-sections';
import { prefetchRouteData } from '@/lib/route-prefetch';
import { useAdminAuthStore } from '@/store/auth';
import { AdminBrandLogo } from '@/components/brand/AdminBrandLogo';

export function UnifiedSidebar() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAdminAuthStore((s) => s.accessToken);
  const { collapsed, toggle, mobileOpen, closeMobile } = useSidebarState();
  const prefetch = useCallback((href: string) => {
    // 1) Prefetch the route's JS bundle, 2) warm its first-mount query cache.
    router.prefetch(href);
    prefetchRouteData(queryClient, href, token);
  }, [router, queryClient, token]);

  const sections = useMemo(() => buildSidebarSections(), []);

  // Width: full drawer on mobile (<lg); collapsible rail on lg+.
  const widthClass = collapsed ? 'w-60 lg:w-[72px]' : 'w-60';

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={closeMobile}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen border-r border-admin-border bg-admin-surface flex flex-col transition-transform duration-200 lg:transition-all',
          widthClass,
          // Off-canvas on mobile; always visible on lg+.
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center border-b border-admin-border shrink-0 justify-between px-4',
            collapsed && 'lg:justify-center lg:px-2'
          )}
        >
          <AdminBrandLogo collapsed={collapsed} href="/dashboard" />
          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={toggle}
            className="hidden lg:inline-flex rounded-md p-1.5 text-admin-muted hover:bg-white/5 hover:text-admin-text transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          {/* Mobile close */}
          <button
            type="button"
            onClick={closeMobile}
            className="lg:hidden rounded-md p-1.5 text-admin-muted hover:bg-white/5 hover:text-admin-text transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className={cn('mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-admin-muted/50', collapsed && 'lg:hidden')}>
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = isSidebarNavActive(pathname, item.href);
                  return (
                    <Link
                      key={`${section.title}-${item.label}`}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      onMouseEnter={() => prefetch(item.href)}
                      onClick={closeMobile}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 px-2.5 py-2',
                        collapsed && 'lg:justify-center lg:px-2',
                        isActive
                          ? 'bg-admin-primary/15 text-admin-primary border border-admin-primary/20'
                          : 'text-admin-muted hover:bg-white/5 hover:text-admin-text border border-transparent'
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className={cn('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={cn('shrink-0 border-t border-admin-border px-4 py-2.5', collapsed && 'lg:hidden')}>
          <p className="text-[10px] text-admin-muted/40 font-medium">Admin Panel v2.0</p>
        </div>
      </aside>
    </>
  );
}
