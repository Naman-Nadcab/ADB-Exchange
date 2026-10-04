import type { Metadata } from 'next';
import { ForexTerminalLayout } from '@/components/forex/ForexTerminalLayout';
import { BRAND_NAME } from '@/lib/brand';
import { FOREX_PRODUCT } from '@/lib/forex/brand';

export const metadata: Metadata = {
  title: `${BRAND_NAME} — Forex`,
  description: `${BRAND_NAME} Forex. ${FOREX_PRODUCT.disclaimer}. Quotes, margin, positions, and account visibility.`,
};

export default function ForexLayout({ children }: { children: React.ReactNode }) {
  return <ForexTerminalLayout>{children}</ForexTerminalLayout>;
}
