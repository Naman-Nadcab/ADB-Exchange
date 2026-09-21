'use client';

import { useTranslations } from 'next-intl';
import { ForexAccountNav } from '@/components/forex/ForexAccountNav';
import { ForexAccountCenter } from '@/components/forex/ForexAccountCenter';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';

export default function ForexAccountsPage() {
  const tf = useTranslations('forex');
  return (
    <ForexPageFrame
      title={tf('pages.accounts.title')}
      subtitle={tf('pages.accounts.subtitle')}
      actions={<ForexAccountNav />}
    >
      <ForexAccountCenter />
    </ForexPageFrame>
  );
}
