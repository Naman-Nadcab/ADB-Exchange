'use client';

import { useEffect } from 'react';
import { ForexPositionPanel } from '@/components/forex/ForexPositionPanel';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';

export default function ForexPortfolioPage() {
  const setWorkspace = useForexWorkspaceStore((s) => s.setWorkspace);
  useEffect(() => {
    setWorkspace('portfolio');
  }, [setWorkspace]);
  return (
    <div className="md:hidden">
      <ForexPositionPanel />
    </div>
  );
}
