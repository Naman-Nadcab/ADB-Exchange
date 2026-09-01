'use client';

import { useEffect } from 'react';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';

export default function ForexAnalysisPage() {
  const setWorkspace = useForexWorkspaceStore((s) => s.setWorkspace);
  useEffect(() => {
    setWorkspace('analysis');
  }, [setWorkspace]);
  return (
    <p className="p-3 text-[12px] text-stone-500 md:hidden">
      Analysis workspace. Historical OHLC is not available on the Forex backend.
    </p>
  );
}
