'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, PanelLeftClose, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSidebarState } from './SidebarContext';
import { buildSidebarSections, isSidebarNavActive, type NavItem } from '@/lib/admin/nav-sections';
import { forexGroupForPathname } from '@/lib/admin/forex-nav-groups';
import { prefetchRouteData } from '@/lib/route-prefetch';
import { useAdminAuthStore } from '@/store/auth';
import { AdminBrandLogo } from '@/components/brand/AdminBrandLogo';

const FOREX_OPEN_KEY = 'admin-forex-nav-open';

function readForexOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(FOREX_OPEN_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function NavLink(props: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onPrefetch: (href: string) => void;
  onNavigate: () => void;
}) {
  const { item, isActive, collapsed, onPrefetch, onNavigate } = props;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      onMouseEnter={() => onPrefetch(item.href)}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 px-2.5 py-2',
        collapsed && 'lg:justify-center lg:px-2',
        isActive
          ? 'bg-admin-primary/15 text-admin-primary border border-admin-primary/20'
          : 'text-admin-muted hover:bg-white/5 hover:text-admin-text border border-transparent',
      )}
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      <span className={cn('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
    </Link>
  );
}

export function UnifiedSidebar() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAdminAuthStore((s) => s.accessToken);
  const { collapsed, toggle, mobileOpen, closeMobile } = useSidebarState();
  const [forexOpen, setForexOpen] = useState<Record<string, boolean>>({});

  const activeForexGroupId = pathname.startsWith('/forex') ? forexGroupForPathname(pathname).id : null;

  useEffect(() => {
    const stored = readForexOpen();
    if (activeForexGroupId) stored[activeForexGroupId] = true;
    setForexOpen(stored);
  }, [activeForexGroupId]);

  const toggleForexGroup = useCallback((id: string) => {
    setForexOpen((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(FOREX_OPEN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const prefetch = useCallback(
    (href: string) => {
      router.prefetch(href);
      prefetchRouteData(queryClient, href, token);
    },
    [router, queryClient, token],
  );

  const sections = useMemo(() => buildSidebarSections(), []);

  const widthClass = collapsed ? 'w-60 lg:w-[72px]' : 'w-60';

  return (
    <>
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
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center border-b border-admin-border shrink-0 justify-between px-4',
            collapsed && 'lg:justify-center lg:px-2',
          )}
        >
          <AdminBrandLogo collapsed={collapsed} href="/dashboard" />
          <button
            type="button"
            onClick={toggle}
            className="hidden lg:inline-flex rounded-md p-1.5 text-admin-muted hover:bg-white/5 hover:text-admin-text transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
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
              {section.forexGroups ? (
                <div className="space-y-1">
                  {section.forexGroups.map((group) => {
                    const isGroupActive = activeForexGroupId === group.id;
                    const isOpen = collapsed ? false : (forexOpen[group.id] ?? isGroupActive);
                    return (
                      <div key={group.id}>
                        <button
                          type="button"
                          onClick={() => toggleForexGroup(group.id)}
                          title={collapsed ? group.label : undefined}
                          className={cn(
                            'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide',
                            collapsed && 'lg:justify-center lg:px-1',
                            isGroupActive ? 'text-admin-primary' : 'text-admin-muted hover:text-admin-text',
                          )}
                        >
                          {!collapsed ? (
                            isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            )
                          ) : null}
                          <span className={cn('truncate', collapsed && 'lg:hidden')}>{group.label}</span>
                        </button>
                        {isOpen && !collapsed ? (
                          <div className="ml-1 space-y-0.5 border-l border-admin-border/40 pl-2">
                            {group.items.map((item) => (
                              <NavLink
                                key={item.href}
                                item={item}
                                isActive={isSidebarNavActive(pathname, item.href)}
                                collapsed={collapsed}
                                onPrefetch={prefetch}
                                onNavigate={closeMobile}
                              />
                            ))}
                          </div>
                        ) : collapsed ? (
                          <div className="hidden space-y-0.5 lg:block">
                            {group.items.map((item) => (
                              <NavLink
                                key={item.href}
                                item={item}
                                isActive={isSidebarNavActive(pathname, item.href)}
                                collapsed={collapsed}
                                onPrefetch={prefetch}
                                onNavigate={closeMobile}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {(section.items ?? []).map((item) => (
                    <NavLink
                      key={`${section.title}-${item.label}`}
                      item={item}
                      isActive={isSidebarNavActive(pathname, item.href)}
                      collapsed={collapsed}
                      onPrefetch={prefetch}
                      onNavigate={closeMobile}
                    />
                  ))}
                </div>
              )}
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
