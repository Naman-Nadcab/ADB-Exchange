'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { BRAND_NAME, BRAND_NAME_SHORT } from '@/lib/brand';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { ROUTES, SPOT_TRADE_HREF } from '@/lib/routes';

export function EdaPublicFooter() {
  const tn = useTranslations('navigation');

  const cols: Array<{ titleKey: 'markets' | 'publicFooter.platform' | 'publicFooter.support' | 'publicFooter.legal'; links: Array<{ href: string; labelKey: string }> }> = [
    {
      titleKey: 'markets',
      links: [
        { href: SPOT_TRADE_HREF, labelKey: 'crypto' },
        { href: FOREX_ROUTES.trade, labelKey: 'forex' },
        { href: ROUTES.markets, labelKey: 'markets' },
        { href: ROUTES.p2p, labelKey: 'p2p' },
      ],
    },
    {
      titleKey: 'publicFooter.platform',
      links: [
        { href: SPOT_TRADE_HREF, labelKey: 'trade' },
        { href: ROUTES.dashboard.api, labelKey: 'api' },
        { href: ROUTES.dashboard.security, labelKey: 'security' },
        { href: ROUTES.dashboard.help, labelKey: 'publicFooter.status' },
      ],
    },
    {
      titleKey: 'publicFooter.support',
      links: [
        { href: ROUTES.dashboard.help, labelKey: 'publicFooter.help' },
        { href: ROUTES.dashboard.announcements, labelKey: 'publicFooter.announcements' },
        { href: ROUTES.dashboard.help, labelKey: 'publicFooter.serviceStatus' },
      ],
    },
    {
      titleKey: 'publicFooter.legal',
      links: [
        { href: ROUTES.terms, labelKey: 'publicFooter.terms' },
        { href: ROUTES.privacy, labelKey: 'publicFooter.privacy' },
        { href: ROUTES.terms, labelKey: 'publicFooter.riskDisclosure' },
      ],
    },
  ];

  const colTitle = (key: (typeof cols)[number]['titleKey']) => {
    if (key === 'markets') return tn('markets');
    return tn(key);
  };

  const linkLabel = (labelKey: string) => tn(labelKey as Parameters<typeof tn>[0]);

  return (
    <footer className="border-t border-border bg-card text-muted-foreground">
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <BrandLogo variant="horizontal" size="header" href={ROUTES.home} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {BRAND_NAME_SHORT} — {BRAND_NAME}
            </p>
          </div>
          <p className="hidden text-[12px] sm:block">{tn('publicFooter.tagline')}</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {cols.map((col) => (
            <div key={col.titleKey}>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">{colTitle(col.titleKey)}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((link) => (
                  <li key={`${col.titleKey}-${link.labelKey}-${link.href}`}>
                    <Link href={link.href} className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {linkLabel(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 border-t border-border pt-5 text-[12px]">
          © {new Date().getFullYear()} {BRAND_NAME_SHORT} — {BRAND_NAME}. {tn('publicFooter.copyrightSuffix')}
        </p>
      </div>
    </footer>
  );
}
