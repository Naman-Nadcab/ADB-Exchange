'use client';

import { useTranslations } from 'next-intl';
import { ForexAccountCenter } from '@/components/forex/ForexAccountCenter';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';

export default function ForexAccountsPage() {
  const tf = useTranslations('forex');
  return (
    <ForexPageFrame wide title={tf('pages.accounts.title')} subtitle={tf('pages.accounts.subtitle')}>
      <ForexPortalAccountContext />
      <ForexAccountCenter />
    </ForexPageFrame>
  );
}
