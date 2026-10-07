'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
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
import { persistPlatformLocalePreference } from '@/lib/i18n/persist-platform-locale';
import { useAuthStore } from '@/store/auth';
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
  const { accessToken, isAuthenticated, _hasHydrated } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const activeLocale: AppLocale = isAppLocale(locale) ? locale : 'en';
  const activeLabel = LOCALE_LABELS[activeLocale];

  const onSelect = useCallback(
    (next: AppLocale) => {
      if (next === activeLocale) {
        setOpen(false);
        return;
      }
      startTransition(async () => {
        const result = await setLocaleAction(next, { explicit: true });
        if (result.ok && _hasHydrated && isAuthenticated && accessToken) {
          await persistPlatformLocalePreference(accessToken, next);
        }
        setOpen(false);
        router.refresh();
      });
    },
    [activeLocale, router, _hasHydrated, isAuthenticated, accessToken]
  );

  useEffect(() => {
    if (!open) return;
    const idx = APP_LOCALES.indexOf(activeLocale);
    setFocusIndex(idx >= 0 ? idx : 0);
  }, [open, activeLocale]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((i) => (i + 1) % APP_LOCALES.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => (i - 1 + APP_LOCALES.length) % APP_LOCALES.length);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(APP_LOCALES[focusIndex]!);
      }
    },
    [open, focusIndex, onSelect]
  );

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLButtonElement>(`[data-locale-index="${focusIndex}"]`);
    el?.focus();
  }, [open, focusIndex]);

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
        onKeyDown={onKeyDown}
        disabled={pending}
      >
        <Globe className={variant === 'compact' ? 'h-3.5 w-3.5 shrink-0 opacity-80' : 'h-4 w-4 shrink-0 opacity-80'} aria-hidden />
        {variant === 'compact' ? (
          <span className="font-semibold sm:hidden">{activeLocale === 'zh-CN' ? '中文' : activeLocale === 'id-ID' ? 'ID' : 'EN'}</span>
        ) : null}
        <span className={variant === 'compact' ? 'hidden max-w-[9rem] truncate font-medium sm:inline' : 'max-w-[9rem] truncate font-medium'}>{activeLabel}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-70 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label={t('menuLabel')}
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />
          <ul
            ref={listRef}
            role="listbox"
            aria-label={t('menuLabel')}
            aria-activedescendant={`locale-option-${APP_LOCALES[focusIndex]}`}
            className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[11rem] overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {APP_LOCALES.map((code, index) => {
              const selected = code === activeLocale;
              return (
                <li key={code} id={`locale-option-${code}`} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    data-locale-index={index}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                      (selected || index === focusIndex) && 'bg-accent/60 font-medium'
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
