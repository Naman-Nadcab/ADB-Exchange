'use client';

import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { BRAND_NAME, BRAND_NAME_SHORT, BRAND_PRODUCT } from '@/lib/brand';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { ROUTES, SPOT_TRADE_HREF, walletPath } from '@/lib/routes';

export function PublicFooter() {
  return (
    <footer className="border-t border-[#F5B8001A] bg-[#05070B]">
      <div className="mx-auto grid max-w-[1320px] gap-8 px-4 py-11 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr] lg:gap-9 lg:px-8">
        <div>
          <BrandLogo variant="footer" size="footer" className="mb-1" />
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">{BRAND_NAME_SHORT}</p>
          <p className="text-xs text-[#AEB6C4]">{BRAND_NAME}</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[#AEB6C4]">
            {BRAND_PRODUCT.crypto}, {BRAND_PRODUCT.forex}, P2P, wallet, and API on one professional platform.
          </p>
          <p className="mt-4 text-xs uppercase tracking-[0.1em] text-[#F5B800]">Service health monitored continuously</p>
        </div>

        {[
          {
            title: 'Products',
            links: [
              { label: 'Crypto', href: SPOT_TRADE_HREF },
              { label: 'Forex', href: FOREX_ROUTES.trade },
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
              { label: 'Service Health', href: `${ROUTES.home}#system-status` },
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
                    className="inline-flex min-h-[40px] min-w-[44px] items-center text-[#AEB6C4] underline underline-offset-2 decoration-[#AEB6C4]/40 transition hover:text-white hover:decoration-white/60"
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
        © {new Date().getFullYear()} {BRAND_NAME_SHORT} — {BRAND_NAME}. Crypto, Forex, P2P, and wallet on one platform.
      </div>
    </footer>
  );
}
