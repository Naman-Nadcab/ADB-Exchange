import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/pageMetadata';
import MarketsPublicShell from './MarketsPublicShell';

export const metadata: Metadata = PAGE_METADATA.markets;

export default function MarketsLayout({ children }: { children: React.ReactNode }) {
  return <MarketsPublicShell>{children}</MarketsPublicShell>;
}
