'use client';

import Link from 'next/link';
import { ROUTES, SPOT_TRADE_HREF, walletPath } from '@/lib/routes';

export function PublicFooter() {
  return (
    <footer className="border-t border-[#F5B8001A] bg-[#05070B]">
      <div className="mx-auto grid max-w-[1320px] gap-8 px-4 py-11 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr] lg:gap-9 lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#F5B800] font-bold text-[#05070B]">M</span>
            <span className="text-base font-semibold tracking-[0.01em]">Methereum Exchange</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[#AEB6C4]">
            Institutional-grade crypto infrastructure for secure trading and capital operations.
          </p>
          <p className="mt-4 text-xs uppercase tracking-[0.1em] text-[#F5B800]">24/7 monitored infrastructure</p>
        </div>

        {[
          {
            title: 'Products',
            links: [
              { label: 'Spot', href: SPOT_TRADE_HREF },
              { label: 'P2P', href: ROUTES.p2p },
              { label: 'Earn', href: ROUTES.earn },
              { label: 'Convert', href: walletPath.convert },
            ],
          },
          {
            title: 'Support',
            links: [
              { label: 'Help Center', href: ROUTES.dashboard.help },
              { label: 'Announcements', href: ROUTES.dashboard.announcements },
              { label: 'System Status', href: ROUTES.dashboard.help },
            ],
          },
          {
            title: 'Company',
            links: [
              { label: 'About', href: ROUTES.home },
              { label: 'Security', href: ROUTES.dashboard.security },
              { label: 'API Docs', href: ROUTES.dashboard.api },
            ],
          },
          {
            title: 'Legal',
            links: [
              { label: 'Terms', href: ROUTES.terms },
              { label: 'Privacy', href: ROUTES.privacy },
              { label: 'Risk Disclosure', href: ROUTES.terms },
            ],
          },
          {
            title: 'Community',
            links: [
              { label: 'Support Updates', href: ROUTES.dashboard.help },
              { label: 'Announcements', href: ROUTES.dashboard.announcements },
              { label: 'Referral Program', href: ROUTES.dashboard.referral },
            ],
          },
        ].map((group) => (
          <div key={group.title}>
            <p className="text-xs uppercase tracking-[0.12em] text-[#AEB6C4]">{group.title}</p>
            <ul className="mt-2 space-y-0.5 text-sm">
              {group.links.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    prefetch
                    className="inline-flex min-h-[40px] min-w-[44px] items-center text-[#AEB6C4] transition hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[#F5B80014] py-4 text-center text-xs text-[#AEB6C4]">
        © {new Date().getFullYear()} Methereum. Institutional infrastructure, continuously monitored.
      </div>
    </footer>
  );
}
