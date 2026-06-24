'use client';

/**
 * P2P trading shell: full-viewport, no dashboard sidebar — same philosophy as /trade.
 * Shared PublicHeader + P2P sub-navigation (see P2PHeader).
 */
import SessionManager from '@/components/SessionManager';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { P2PHeader } from '@/components/p2p-v2/P2PHeader';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

const MOBILE_NAV_PAD = 'pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-0';

export default function P2PShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionManager redirectPath="/login" />
      <div className="min-h-screen bg-background">
        <div className={`flex min-h-screen w-full flex-col ${MOBILE_NAV_PAD}`}>
          <PublicHeader />
          <P2PHeader />
          <main className="mx-auto w-full max-w-[1600px] flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">{children}</main>
          <PublicFooter />
        </div>
        <MobileBottomNav />
      </div>
    </>
  );
}
