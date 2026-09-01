'use client';

import { ForexOrderTicket } from '@/components/forex/ForexOrderTicket';
import { ForexWatchlist } from '@/components/forex/ForexWatchlist';

export default function ForexTradePage() {
  return (
    <div className="grid gap-0 md:hidden">
      <div className="h-[280px] overflow-hidden">
        <ForexWatchlist />
      </div>
      <div className="min-h-[320px]">
        <ForexOrderTicket />
      </div>
    </div>
  );
}
