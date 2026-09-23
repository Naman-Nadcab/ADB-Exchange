'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ForexAccountSwitcher } from './ForexAccountSwitcher';
import {
  FOREX_PORTAL_NAV,
  FOREX_ROUTES,
  isForexPortalNavActive,
  isForexPortalSectionPath,
} from '@/lib/forex/routes';
import { cn } from '@/lib/utils';

export function ForexPortalMobileMenu(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname() ?? '';
  const tf = useTranslations('forex');

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        className="fixed bottom-0 left-0 top-auto max-h-[85dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-xl border-border p-0 sm:max-w-lg sm:left-[50%] sm:translate-x-[-50%]"
      >
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <DialogTitle className="text-base font-semibold">{tf('portalNav.menuTitle')}</DialogTitle>
          <div className="pt-2">
            <ForexAccountSwitcher />
          </div>
        </DialogHeader>
        <nav className="flex flex-col gap-0.5 overflow-y-auto px-2 py-2" aria-label={tf('portalNav.sectionsAria')}>
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
        </nav>
      </DialogContent>
    </Dialog>
  );
}

export function isForexMobilePortalTabActive(pathname: string): boolean {
  return isForexPortalSectionPath(pathname);
}
