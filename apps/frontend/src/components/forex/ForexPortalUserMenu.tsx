'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { UserRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CUSTOMER_ACCOUNT_MENU, CUSTOMER_ACCOUNT_ROUTES } from '@/lib/account/customer-account';
import { performLogout } from '@/lib/authLogout';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexSession } from '@/lib/forex/runtime/useForexSession';
import { useLoginHref } from '@/lib/useLoginHref';
import { cn } from '@/lib/utils';

const ACCOUNT_LINKS = [
  ...CUSTOMER_ACCOUNT_MENU.map((item) => ({
    href: item.href,
    labelKey: `userMenu.${item.key}` as const,
  })),
  { href: CUSTOMER_ACCOUNT_ROUTES.support, labelKey: 'userMenu.support' as const },
  { href: CUSTOMER_ACCOUNT_ROUTES.help, labelKey: 'userMenu.help' as const },
] as const;

export function ForexPortalUserMenu(props?: { compact?: boolean }) {
  const tf = useTranslations('forex');
  const tn = useTranslations('navigation');
  const session = useForexSession();
  const loginHref = useLoginHref();

  if (session.resolving) {
    return <span className="inline-block h-8 w-8 shrink-0" aria-hidden />;
  }

  if (session.status === 'SIGNED_OUT') {
    return (
      <Link
        href={loginHref}
        className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {tn('logIn')}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          'inline-flex items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'h-8 w-8 shrink-0'
        )}
        aria-label={tf('userMenu.label')}
      >
        <UserRound className={props?.compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {ACCOUNT_LINKS.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href} className="cursor-pointer text-[13px]">
              {tf(item.labelKey)}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={FOREX_ROUTES.partner} className="cursor-pointer text-[13px]">
            {tf('userMenu.partner')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={CUSTOMER_ACCOUNT_ROUTES.dashboard} className="cursor-pointer text-[13px] text-muted-foreground">
            {tf('userMenu.platformDashboard')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-[13px] text-destructive focus:text-destructive"
          onSelect={() => {
            void performLogout('/login');
          }}
        >
          {tn('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
