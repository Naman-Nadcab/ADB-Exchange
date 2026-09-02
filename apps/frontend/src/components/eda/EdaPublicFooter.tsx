import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { ROUTES, SPOT_TRADE_HREF } from '@/lib/routes';

const COLS: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
  {
    title: 'Markets',
    links: [
      { href: SPOT_TRADE_HREF, label: 'Crypto' },
      { href: FOREX_ROUTES.trade, label: 'Forex' },
      { href: ROUTES.markets, label: 'Markets' },
      { href: ROUTES.p2p, label: 'P2P' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { href: SPOT_TRADE_HREF, label: 'Trade' },
      { href: ROUTES.dashboard.api, label: 'API' },
      { href: ROUTES.dashboard.security, label: 'Security' },
      { href: ROUTES.dashboard.help, label: 'Status' },
    ],
  },
  {
    title: 'Support',
    links: [
      { href: ROUTES.dashboard.help, label: 'Help' },
      { href: ROUTES.dashboard.announcements, label: 'Announcements' },
      { href: ROUTES.dashboard.help, label: 'Service Status' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: ROUTES.terms, label: 'Terms' },
      { href: ROUTES.privacy, label: 'Privacy' },
      { href: ROUTES.terms, label: 'Risk Disclosure' },
    ],
  },
];

export function EdaPublicFooter() {
  return (
    <footer className="border-t border-border bg-card text-muted-foreground">
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <BrandLogo variant="horizontal-gold" size="header" href={ROUTES.home} />
          <p className="hidden text-[12px] sm:block">Global financial platform · Crypto and Forex</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {COLS.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">{col.title}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 border-t border-border pt-5 text-[12px]">© 2026 EDA. Digital assets and global FX.</p>
      </div>
    </footer>
  );
}
