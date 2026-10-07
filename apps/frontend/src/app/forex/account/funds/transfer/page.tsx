'use client';

import { useTranslations } from 'next-intl';
import { ForexFundingUnavailablePanel } from '@/components/forex/ForexFundingUnavailablePanel';
import { ForexInternalTransferForm } from '@/components/forex/ForexInternalTransferForm';
import { ForexFundsSubNav } from '@/components/forex/ForexFundsSubNav';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';
import { useForexProductGates } from '@/lib/forex/hooks/useForexProductGates';

export default function ForexFundsTransferPage() {
  const tf = useTranslations('forex');
  const { gates } = useForexProductGates();

  return (
    <ForexPageFrame title={tf('pages.fundsTransfer.title')} subtitle={tf('pages.fundsTransfer.subtitle')}>
      <ForexPortalAccountContext />
      <ForexFundsSubNav />
      {gates.internalTransferEnabled ? <ForexInternalTransferForm /> : <ForexFundingUnavailablePanel variant="transfer" />}
    </ForexPageFrame>
  );
}
