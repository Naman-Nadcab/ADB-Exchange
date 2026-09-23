'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { ForexAccountDetailView } from '@/components/forex/ForexAccountDetailView';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';

export default function ForexAccountDetailPage() {
  const tf = useTranslations('forex');
  const params = useParams();
  const accountId = String(params?.accountId ?? '');

  return (
    <ForexPageFrame title={tf('pages.accountDetail.title')} subtitle={tf('pages.accountDetail.subtitle')}>
      <ForexPortalAccountContext />
      <ForexAccountDetailView accountId={accountId} />
    </ForexPageFrame>
  );
}
