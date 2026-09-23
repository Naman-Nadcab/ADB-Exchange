'use client';

import { useTranslations } from 'next-intl';
import { ForexAccountCenter } from '@/components/forex/ForexAccountCenter';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';

export default function ForexAccountsPage() {
  const tf = useTranslations('forex');
  return (
    <ForexPageFrame title={tf('pages.accounts.title')} subtitle={tf('pages.accounts.subtitle')}>
      <ForexAccountCenter />
    </ForexPageFrame>
  );
}
