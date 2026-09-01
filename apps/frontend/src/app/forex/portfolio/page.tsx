'use client';

import { useEffect } from 'react';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';

export default function ForexPortfolioPage() {
  const setWorkspace = useForexWorkspaceStore((s) => s.setWorkspace);
  useEffect(() => {
    setWorkspace('portfolio');
  }, [setWorkspace]);
  return (
    <p className="p-3 text-[12px] text-stone-500 md:hidden">
      Portfolio uses backend positions, margin, and risk in the terminal panels.
    </p>
  );
}
