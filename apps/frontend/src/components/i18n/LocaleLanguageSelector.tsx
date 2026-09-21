'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, Globe } from 'lucide-react';
import {
  APP_LOCALES,
  LOCALE_LABELS,
  type AppLocale,
  isAppLocale,
} from '@/i18n/config';
import { setLocaleAction } from '@/i18n/actions/set-locale';
import { cn } from '@/lib/utils';

type LocaleLanguageSelectorProps = {
  className?: string;
  /** Compact styling for Forex terminal chrome. */
  variant?: 'default' | 'compact';
};

export function LocaleLanguageSelector({ className = '', variant = 'default' }: LocaleLanguageSelectorProps) {
  const t = useTranslations('common.languageSelector');
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const activeLocale: AppLocale = isAppLocale(locale) ? locale : 'en';
  const activeLabel = LOCALE_LABELS[activeLocale];

  const onSelect = useCallback(
    (next: AppLocale) => {
      if (next === activeLocale) {
        setOpen(false);
        return;
      }
      startTransition(async () => {
        await setLocaleAction(next, { explicit: true });
        setOpen(false);
        router.refresh();
      });
    },
    [activeLocale, router]
  );

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        className={cn(
          'tap-target inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/80 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          variant === 'compact' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-sm',
          pending && 'opacity-70'
        )}
        aria-label={t('ariaLabel')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
      >
        <Globe className={variant === 'compact' ? 'h-3.5 w-3.5 shrink-0 opacity-80' : 'h-4 w-4 shrink-0 opacity-80'} aria-hidden />
        <span className="max-w-[9rem] truncate font-medium">{activeLabel}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-70 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label={t('menuLabel')}
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            aria-label={t('menuLabel')}
            className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[11rem] overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {APP_LOCALES.map((code) => {
              const selected = code === activeLocale;
              return (
                <li key={code} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                      selected && 'bg-accent/60 font-medium'
                    )}
                    onClick={() => onSelect(code)}
                  >
                    <span lang={code === 'zh-CN' ? 'zh-CN' : code === 'id-ID' ? 'id' : 'en'}>{LOCALE_LABELS[code]}</span>
                    {selected ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : <span className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
