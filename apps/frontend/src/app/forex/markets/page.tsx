'use client';

import { useEffect } from 'react';
import { ForexWatchlist } from '@/components/forex/ForexWatchlist';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';

export default function ForexMarketsPage() {
  const setWorkspace = useForexWorkspaceStore((s) => s.setWorkspace);
  useEffect(() => {
    setWorkspace('analysis');
  }, [setWorkspace]);
  return (
    <div className="md:hidden h-full">
      <ForexWatchlist />
    </div>
  );
}
