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
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';

const PLATFORM_LINKS = [
  { href: ROUTES.dashboard.identity, labelKey: 'userMenu.verification' as const },
  { href: ROUTES.dashboard.security, labelKey: 'userMenu.security' as const },
  { href: '/dashboard/support', labelKey: 'userMenu.support' as const },
  { href: ROUTES.dashboard.help, labelKey: 'userMenu.help' as const },
] as const;

export function ForexPortalUserMenu(props?: { compact?: boolean }) {
  const tf = useTranslations('forex');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          'inline-flex items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          props?.compact ? 'h-8 w-8' : 'tap-target h-9 w-9'
        )}
        aria-label={tf('userMenu.label')}
      >
        <UserRound className={props?.compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {PLATFORM_LINKS.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href} className="cursor-pointer text-[13px]">
              {tf(item.labelKey)}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={ROUTES.dashboard.root} className="cursor-pointer text-[13px] text-muted-foreground">
            {tf('userMenu.platformDashboard')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
