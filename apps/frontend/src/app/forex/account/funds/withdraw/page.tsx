'use client';

import { useTranslations } from 'next-intl';
import { ForexFundingUnavailablePanel } from '@/components/forex/ForexFundingUnavailablePanel';
import { ForexLiveCashForm } from '@/components/forex/ForexLiveCashForm';
import { ForexFundsSubNav } from '@/components/forex/ForexFundsSubNav';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';
import { useForexProductGates } from '@/lib/forex/hooks/useForexProductGates';

export default function ForexFundsWithdrawPage() {
  const tf = useTranslations('forex');
  const { gates } = useForexProductGates();

  return (
    <ForexPageFrame title={tf('pages.fundsWithdraw.title')} subtitle={tf('pages.fundsWithdraw.subtitle')}>
      <ForexPortalAccountContext />
      <ForexFundsSubNav />
      {gates.withdrawalEnabled ? <ForexLiveCashForm direction="withdraw" /> : <ForexFundingUnavailablePanel variant="withdraw" />}
    </ForexPageFrame>
  );
}
