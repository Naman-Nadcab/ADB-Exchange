'use client';

import { ForexAccountNav } from '@/components/forex/ForexAccountNav';
import { ForexAccountCenter } from '@/components/forex/ForexAccountCenter';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';

export default function ForexAccountsPage() {
  return (
    <ForexPageFrame
      title="Forex accounts"
      subtitle="SIMULATED demo accounts only. Live account opening is not available while REAL_FOREX is off."
      actions={<ForexAccountNav />}
    >
      <ForexAccountCenter />
    </ForexPageFrame>
  );
}
