import type { Metadata } from 'next';
import { ForexTerminalLayout } from '@/components/forex/ForexTerminalLayout';
import { BRAND_NAME_SHORT } from '@/lib/brand';
import { FOREX_PRODUCT } from '@/lib/forex/brand';

export const metadata: Metadata = {
  title: `${FOREX_PRODUCT.productName} — Trade`,
  description: `${FOREX_PRODUCT.productName} on ${BRAND_NAME_SHORT}. ${FOREX_PRODUCT.disclaimer}. Quotes, margin, positions and account visibility.`,
};

export default function ForexLayout({ children }: { children: React.ReactNode }) {
  return <ForexTerminalLayout>{children}</ForexTerminalLayout>;
}
