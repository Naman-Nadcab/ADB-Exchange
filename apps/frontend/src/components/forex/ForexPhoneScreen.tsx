'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useForexWorkspaceStore, type ForexBottomTab } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { ForexPortalMobileMenu } from './ForexPortalMobileMenu';

export type ForexPhoneScreen = 'chart' | 'watch' | 'trade' | 'book';

type PhoneContextValue = {
  screen: ForexPhoneScreen;
  setScreen: (screen: ForexPhoneScreen) => void;
};

const PhoneContext = createContext<PhoneContextValue | null>(null);

export function ForexPhoneScreenProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<ForexPhoneScreen>('chart');
  return <PhoneContext.Provider value={{ screen, setScreen }}>{children}</PhoneContext.Provider>;
}

export function useForexPhoneScreen(): PhoneContextValue {
  const value = useContext(PhoneContext);
  if (value) return value;
  return { screen: 'chart', setScreen: () => {} };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const apply = () => setMatches(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [query]);
  return matches;
}

export function ForexPhoneTabBar() {
  const t = useTranslations('forex.mobileTrade');
  const tf = useTranslations('forex');
  const { screen, setScreen } = useForexPhoneScreen();
  const bottomTab = useForexWorkspaceStore((s) => s.bottomTab);
  const setBottomTab = useForexWorkspaceStore((s) => s.setBottomTab);
  const [moreOpen, setMoreOpen] = useState(false);
  const toolTabs = ['alerts', 'news', 'journal', 'mailbox', 'calendar', 'risk'] as const satisfies readonly ForexBottomTab[];
  const terminalTools = toolTabs.map((id) => ({ id, label: tf(`bottomTabs.${id}`) }));
  const bookTool = screen === 'book' && bottomTab !== 'positions' && bottomTab !== 'orders' && bottomTab !== 'history';
  const items = [
    { id: 'chart' as const, label: t('chart'), active: screen === 'chart' || screen === 'watch' },
    { id: 'trade' as const, label: t('trade'), active: screen === 'trade' },
    { id: 'positions' as const, label: t('positions'), active: screen === 'book' && (bottomTab === 'positions' || bottomTab === 'orders') },
    { id: 'history' as const, label: t('history'), active: screen === 'book' && bottomTab === 'history' },
  ];
  return (
    <>
      <nav
        className="flex min-h-14 shrink-0 items-stretch border-t border-border bg-card pb-[env(safe-area-inset-bottom,0px)] md:hidden"
        aria-label={t('shellAria')}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={item.active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 min-w-0 flex-1 items-center justify-center px-1 text-[11px] font-medium',
              item.active ? 'text-primary' : 'text-muted-foreground'
            )}
            onClick={() => {
              if (item.id === 'chart') setScreen('chart');
              else if (item.id === 'trade') setScreen('trade');
              else if (item.id === 'positions') {
                setBottomTab('positions');
                setScreen('book');
              } else {
                setBottomTab('history');
                setScreen('book');
              }
            }}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          aria-current={bookTool ? 'page' : undefined}
          className={cn(
            'flex min-h-11 min-w-0 flex-1 items-center justify-center px-1 text-[11px] font-medium',
            bookTool ? 'text-primary' : 'text-muted-foreground'
          )}
          onClick={() => setMoreOpen(true)}
        >
          {tf('nav.more')}
        </button>
      </nav>
      <ForexPortalMobileMenu
        open={moreOpen}
        onOpenChange={setMoreOpen}
        terminalTools={terminalTools}
        activeToolId={bookTool ? bottomTab : undefined}
        onTerminalTool={(id) => {
          setBottomTab(id as ForexBottomTab);
          setScreen('book');
        }}
      />
    </>
  );
}
