'use client';

'use client';

import { ForexPartnerDesk } from '@/components/forex/ForexPrograms';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';

export default function ForexPartnerPage() {
  return (
    <ForexPageFrame wide title="Partner" subtitle="One code, your clients, and a payout request. The rate is set by admin.">
      <ForexPortalAccountContext />
      <ForexPartnerDesk />
    </ForexPageFrame>
  );
}
