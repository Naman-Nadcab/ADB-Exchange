import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/pageMetadata';
import { HomeForexProductPair } from '@/components/forex/HomeForexProductPair';
import HomePageClient from './HomePageClient';

export const metadata: Metadata = PAGE_METADATA.home;

export default function HomePage() {
  return (
    <>
      <HomeForexProductPair />
      <HomePageClient />
    </>
  );
}
