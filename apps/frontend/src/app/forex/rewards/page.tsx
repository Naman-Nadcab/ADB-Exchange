'use client';

'use client';

import { ForexRewardsDesk } from '@/components/forex/ForexPrograms';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';

export default function ForexRewardsPage() {
  return (
    <ForexPageFrame wide title="Rewards" subtitle="Bonus, savings, and achievements on the selected account.">
      <ForexPortalAccountContext />
      <ForexRewardsDesk />
    </ForexPageFrame>
  );
}
