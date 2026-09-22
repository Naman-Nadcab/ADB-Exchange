'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { BRAND_NAME, BRAND_NAME_SHORT } from '@/lib/brand';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { ROUTES, SPOT_TRADE_HREF, walletPath } from '@/lib/routes';

export function PublicFooter() {
  const tn = useTranslations('navigation');
  const pf = (key: string) => tn(`publicFooter.${key}` as Parameters<typeof tn>[0]);

  const groups = [
    {
      titleKey: 'products',
      links: [
        { labelKey: 'crypto', href: SPOT_TRADE_HREF },
        { labelKey: 'forex', href: FOREX_ROUTES.trade },
        { labelKey: 'p2p', href: ROUTES.p2p },
        { labelKey: 'earn', href: ROUTES.earn },
        { labelKey: 'convert', href: walletPath.convert, pf: true },
      ],
    },
    {
      titleKey: 'support',
      links: [
        { labelKey: 'helpCenter', href: ROUTES.dashboard.help, pf: true },
        { labelKey: 'announcements', href: ROUTES.dashboard.announcements, pf: true },
        { labelKey: 'serviceHealth', href: `${ROUTES.home}#system-status`, pf: true },
      ],
    },
    {
      titleKey: 'company',
      links: [
        { labelKey: 'about', href: ROUTES.home, pf: true },
        { labelKey: 'security', href: ROUTES.dashboard.security },
        { labelKey: 'apiDocs', href: ROUTES.dashboard.api, pf: true },
      ],
    },
    {
      titleKey: 'legal',
      links: [
        { labelKey: 'terms', href: ROUTES.terms, pf: true },
        { labelKey: 'privacy', href: ROUTES.privacy, pf: true },
        { labelKey: 'riskDisclosure', href: ROUTES.terms, pf: true },
      ],
    },
    {
      titleKey: 'community',
      links: [
        { labelKey: 'supportUpdates', href: ROUTES.dashboard.help, pf: true },
        { labelKey: 'announcements', href: ROUTES.dashboard.announcements, pf: true },
        { labelKey: 'referralProgram', href: ROUTES.dashboard.referral, pf: true },
      ],
    },
  ] as const;

  const linkLabel = (link: { labelKey: string; pf?: boolean }) =>
    link.pf ? pf(link.labelKey) : tn(link.labelKey as Parameters<typeof tn>[0]);

  return (
    <footer className="border-t border-[#F5B8001A] bg-[#05070B]">
      <div className="mx-auto grid max-w-[1320px] gap-8 px-4 py-11 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr] lg:gap-9 lg:px-8">
        <div>
          <BrandLogo variant="footer" size="footer" className="mb-1" />
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">{BRAND_NAME_SHORT}</p>
          <p className="text-xs text-[#AEB6C4]">{BRAND_NAME}</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[#AEB6C4]">{pf('marketingBlurb')}</p>
          <p className="mt-4 text-xs uppercase tracking-[0.1em] text-[#F5B800]">{pf('serviceHealthEyebrow')}</p>
        </div>

        {groups.map((group) => (
          <div key={group.titleKey}>
            <p className="text-xs uppercase tracking-[0.12em] text-[#AEB6C4]">{pf(group.titleKey)}</p>
            <ul className="mt-2 space-y-0.5 text-sm">
              {group.links.map((item) => (
                <li key={`${group.titleKey}-${item.labelKey}`}>
                  <Link
                    href={item.href}
                    prefetch
                    className="inline-flex min-h-[40px] min-w-[44px] items-center text-[#AEB6C4] underline underline-offset-2 decoration-[#AEB6C4]/40 transition hover:text-white hover:decoration-white/60"
                  >
                    {linkLabel(item)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[#F5B80014] py-4 text-center text-xs text-[#AEB6C4]">
        © {new Date().getFullYear()} {BRAND_NAME_SHORT} — {BRAND_NAME}. {pf('copyrightLine')}
      </div>
    </footer>
  );
}
