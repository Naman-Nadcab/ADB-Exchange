'use client';

import type { ReactNode } from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { UserRouteWarmup } from '@/components/performance/UserRouteWarmup';

type PublicLayoutProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  beforeMain?: ReactNode;
};

export function PublicLayout({ children, className = 'bg-[#05070B] text-white', contentClassName = 'flex-1', beforeMain }: PublicLayoutProps) {
  return (
    <div className={`mobile-app-shell flex min-h-screen flex-col ${className}`}>
      <UserRouteWarmup />
      <PublicHeader />
      {beforeMain}
      <main id="main-content" tabIndex={-1} className={contentClassName}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
