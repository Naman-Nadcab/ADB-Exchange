'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, LayoutGrid, PlusCircle, ListOrdered, CreditCard, BarChart3 } from 'lucide-react';
import { P2P_HREF } from '@/lib/routes';

const nav = [
  { href: P2P_HREF, label: 'Marketplace', icon: LayoutGrid },
  { href: `${P2P_HREF}/create-ad`, label: 'Post Ad', icon: PlusCircle },
  { href: `${P2P_HREF}/my-ads`, label: 'My Ads', icon: ArrowLeftRight },
  { href: `${P2P_HREF}/orders`, label: 'Orders', icon: ListOrdered },
  { href: `${P2P_HREF}/payment-methods`, label: 'Payments', icon: CreditCard },
  { href: `${P2P_HREF}/merchant-dashboard`, label: 'Dashboard', icon: BarChart3 },
];

/**
 * P2P sub-navigation strip. Renders BELOW the global PublicHeader, so it must be a
 * slim tab bar — no second logo and no auth button (the global header owns brand +
 * account/login). This is the Binance-style "global nav + section tabs" pattern.
 */
export function P2PHeader() {
  const pathname = usePathname();

  return (
    <div className="sticky top-[64px] z-30 border-b border-border/40 bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 py-2 sm:px-6">
        <nav className="flex items-center gap-1 overflow-x-auto" aria-label="P2P sections">
          {nav.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === P2P_HREF
                ? pathname === P2P_HREF
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 sm:justify-start ${
                  isActive
                    ? 'bg-primary/12 text-primary ring-1 ring-primary/15'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
