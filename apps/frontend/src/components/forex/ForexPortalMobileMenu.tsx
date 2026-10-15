'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ForexAccountSwitcher } from './ForexAccountSwitcher';
import {
  FOREX_PORTAL_NAV,
  FOREX_ROUTES,
  FOREX_TOP_NAV,
  isForexPortalNavActive,
  isForexPortalSectionPath,
} from '@/lib/forex/routes';
import { cn } from '@/lib/utils';

export function ForexPortalMobileMenu(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terminalTools?: Array<{ id: string; label: string }>;
  activeToolId?: string;
  onTerminalTool?: (id: string) => void;
}) {
  const pathname = usePathname() ?? '';
  const tf = useTranslations('forex');

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        className="fixed bottom-0 left-0 top-auto max-h-[85dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-xl border-border p-0 pb-[env(safe-area-inset-bottom,0px)] sm:max-w-lg sm:left-[50%] sm:translate-x-[-50%]"
      >
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <DialogTitle className="text-base font-semibold">{tf('portalNav.menuTitle')}</DialogTitle>
          <div className="pt-2">
            <ForexAccountSwitcher />
          </div>
        </DialogHeader>
        <nav className="flex flex-col gap-0.5 overflow-y-auto px-2 py-2" aria-label={tf('portalNav.sectionsAria')}>
          {props.terminalTools && props.terminalTools.length > 0 ? (
            <div className="mb-1 border-b border-border pb-1">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {tf('portalNav.tools')}
              </p>
              {props.terminalTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className={cn(
                    'block w-full rounded-md px-3 py-2.5 text-left text-sm font-medium',
                    props.activeToolId === tool.id ? 'bg-primary/12 text-primary' : 'text-foreground hover:bg-muted/60'
                  )}
                  onClick={() => {
                    props.onTerminalTool?.(tool.id);
                    props.onOpenChange(false);
                  }}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          ) : null}
          {FOREX_TOP_NAV.filter((item) => item.href !== FOREX_ROUTES.trade).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => props.onOpenChange(false)}
              className={cn(
                'rounded-md px-3 py-2.5 text-sm font-medium',
                isForexPortalNavActive(pathname, item.href)
                  ? 'bg-primary/12 text-primary'
                  : 'text-foreground hover:bg-muted/60'
              )}
            >
              {tf(item.labelKey)}
            </Link>
          ))}
          {FOREX_PORTAL_NAV.map((item) => {
            const exact = 'exact' in item && item.exact;
            const active = isForexPortalNavActive(pathname, item.href, exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => props.onOpenChange(false)}
                className={cn(
                  'rounded-md px-3 py-2.5 text-sm font-medium',
                  active ? 'bg-primary/12 text-primary' : 'text-foreground hover:bg-muted/60'
                )}
              >
                {tf(item.labelKey)}
              </Link>
            );
          })}
          <div className="mt-1 border-t border-border pt-1">
            <Link
              href={FOREX_ROUTES.partner}
              onClick={() => props.onOpenChange(false)}
              className={cn(
                'block rounded-md px-3 py-2.5 text-sm font-medium',
                isForexPortalNavActive(pathname, FOREX_ROUTES.partner)
                  ? 'bg-primary/12 text-primary'
                  : 'text-foreground hover:bg-muted/60'
              )}
            >
              {tf('userMenu.partner')}
            </Link>
            <p className="px-3 pb-2 text-[11px] leading-snug text-muted-foreground">{tf('portalNav.partnerHint')}</p>
          </div>
        </nav>
      </DialogContent>
    </Dialog>
  );
}

export function isForexMobilePortalTabActive(pathname: string): boolean {
  return isForexPortalSectionPath(pathname);
}
