'use client';

import { ForexAppsDesk } from '@/components/forex/ForexPrograms';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';

export default function ForexAppsPage() {
  return (
    <ForexPageFrame wide title="Apps" subtitle="Arm an approved strategy on the selected account, send feedback, and download the app when a link is set.">
      <ForexPortalAccountContext />
      <ForexAppsDesk />
    </ForexPageFrame>
  );
}
