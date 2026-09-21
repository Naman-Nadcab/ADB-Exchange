'use client';

import { useTranslations } from 'next-intl';
import { BrandLoading } from '@/components/brand/BrandLoading';

export default function P2PV2Loading() {
  const tp = useTranslations('p2p');
  return <BrandLoading label={tp('loading.label')} />;
}
