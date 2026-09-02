import type { Metadata } from 'next';
import { ForexTerminalLayout } from '@/components/forex/ForexTerminalLayout';

export const metadata: Metadata = {
  title: 'Forex | EDA EXCHANGE',
  description: 'Professional FX trading on EDA — quotes, margin, positions and account visibility.',
};

export default function ForexLayout({ children }: { children: React.ReactNode }) {
  return <ForexTerminalLayout>{children}</ForexTerminalLayout>;
}
