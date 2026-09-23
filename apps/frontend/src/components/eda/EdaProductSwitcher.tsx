'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { ROUTES, SPOT_TRADE_HREF } from '@/lib/routes';
import { cn } from '@/lib/utils';

export type EdaProductSwitcherVariant = 'marketing' | 'terminal';

type ProductId = 'crypto' | 'forex' | 'all';

function currentProduct(pathname: string): ProductId {
  if (pathname.startsWith('/forex')) return 'forex';
  if (
    pathname.startsWith('/trade') ||
    pathname.startsWith('/wallet') ||
    pathname.startsWith('/p2p') ||
    pathname.startsWith('/orders')
  ) {
    return 'crypto';
  }
  return 'all';
}

export function EdaProductSwitcher({ variant = 'marketing' }: { variant?: EdaProductSwitcherVariant }) {
  const t = useTranslations('navigation.productSwitcher');
  const tn = useTranslations('navigation');
  const pathname = usePathname() ?? '';
  const product = currentProduct(pathname);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const labelFor = (p: ProductId, v: EdaProductSwitcherVariant): string => {
    if (v === 'terminal') return p === 'forex' ? t('terminalForex') : t('terminalCrypto');
    if (p === 'forex') return tn('forex');
    if (p === 'crypto') return tn('crypto');
    return t('allMarkets');
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const marketing = variant === 'marketing';
  const triggerClass = marketing
    ? 'inline-flex items-center gap-1.5 rounded-md border border-[#F5B8001F] px-2.5 py-1.5 text-[12px] text-[#9CA3AF] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B800]'
    : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1';
  const menuClass = marketing
    ? 'absolute left-0 top-full z-50 mt-1 min-w-[12.5rem] rounded-lg border border-[#F5B8001F] bg-[#0D1118] py-1 shadow-xl'
    : 'absolute left-0 top-full z-50 mt-1 min-w-[12.5rem] rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-xl';
  const itemClass = marketing
    ? 'flex items-start gap-2 px-3 py-2 text-[12px] text-[#9CA3AF] hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:bg-white/5'
    : 'flex items-start gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
  const headingClass = marketing
    ? 'px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#6B7280]'
    : 'px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground';
  const checkClass = marketing ? 'text-[#F5B800]' : 'text-primary';

  const items: Array<{ id: ProductId; href: string; titleKey: 'allMarkets' | 'crypto' | 'forex'; hintKey: 'allMarketsHint' | 'cryptoHint' | 'forexHint' }> = [
    ...(marketing ? [{ id: 'all' as const, href: ROUTES.home, titleKey: 'allMarkets' as const, hintKey: 'allMarketsHint' as const }] : []),
    { id: 'crypto', href: SPOT_TRADE_HREF, titleKey: 'crypto', hintKey: 'cryptoHint' },
    { id: 'forex', href: FOREX_ROUTES.trade, titleKey: 'forex', hintKey: 'forexHint' },
  ];

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        className={triggerClass}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t('switchProduct')}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <>
          <span className={marketing ? 'text-white/80' : 'font-semibold text-foreground'}>FDM</span>
          <span className={marketing ? 'text-[#F5B800]' : 'text-muted-foreground'}>/</span>
          <span className={marketing ? undefined : 'text-foreground'}>{labelFor(product, variant)}</span>
          {!marketing ? (
            <span aria-hidden className={cn('text-[10px] transition-transform duration-150', open && 'rotate-180')}>
              ▼
            </span>
          ) : null}
        </>
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label={t('productsMenu')} className={menuClass}>
          <p className={headingClass}>{t('productsHeading')}</p>
          {items.map((item) => {
            const active = product === item.id || (item.id === 'crypto' && product === 'all' && variant === 'terminal');
            const title = item.titleKey === 'crypto' || item.titleKey === 'forex' ? tn(item.titleKey) : t(item.titleKey);
            return (
              <Link
                key={item.id}
                role="menuitem"
                href={item.href}
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                <span className={cn('mt-0.5 w-3 shrink-0', active ? checkClass : 'opacity-0')}>✓</span>
                <span>
                  <span className={marketing ? 'block text-white' : 'block font-medium text-foreground'}>{title}</span>
                  <span className={marketing ? 'block text-[10px] text-[#6B7280]' : 'block text-[10px] text-muted-foreground'}>{t(item.hintKey)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
