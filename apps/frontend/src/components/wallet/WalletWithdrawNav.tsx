'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Banknote, Coins } from 'lucide-react';
import { walletPath } from '@/lib/routes';
import { cn } from '@/lib/utils';

export function WalletWithdrawNav() {
  const tw = useTranslations('wallet');
  const TABS = [
    { id: 'crypto' as const, labelKey: 'nav.withdrawCrypto' as const, href: walletPath.withdrawCrypto, icon: Coins },
    { id: 'fiat' as const, labelKey: 'nav.withdrawFiatInr' as const, href: walletPath.withdrawFiat, icon: Banknote },
  ];
  const pathname = usePathname();
  const active = pathname?.includes('/withdraw/fiat') ? 'fiat' : pathname?.includes('/withdraw/crypto') ? 'crypto' : null;

  return (
    <div className="flex gap-2 rounded-xl border border-border bg-muted/30 p-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {tw(tab.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}
