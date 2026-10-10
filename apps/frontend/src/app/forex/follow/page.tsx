'use client';

import { ForexFollowDesk } from '@/components/forex/ForexPrograms';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';

export default function ForexFollowPage() {
  return (
    <ForexPageFrame wide title="Follow" subtitle="Pick one approved manager. The amount is reserved on the selected account until you stop.">
      <ForexPortalAccountContext />
      <ForexFollowDesk />
    </ForexPageFrame>
  );
}
