import Link from 'next/link';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { ROUTES, SPOT_TRADE_HREF } from '@/lib/routes';

const COLS: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
  {
    title: 'Markets',
    links: [
      { href: SPOT_TRADE_HREF, label: 'Crypto' },
      { href: FOREX_ROUTES.root, label: 'Forex' },
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
    <footer className="border-t border-[#F5B8001F] bg-[#05070B] text-[#9CA3AF]">
      <div className="mx-auto grid max-w-[1320px] gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4 sm:px-6 lg:px-8">
        {COLS.map((col) => (
          <div key={col.title}>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#F5B800]">{col.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B800]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
