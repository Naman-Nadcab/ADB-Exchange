import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/pageMetadata';
import TradeShellLayoutClient from './TradeShellLayoutClient';

export const metadata: Metadata = PAGE_METADATA.trade;

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return <TradeShellLayoutClient>{children}</TradeShellLayoutClient>;
}
