import type { Metadata } from 'next';
import { ForexTerminalLayout } from '@/components/forex/ForexTerminalLayout';

export const metadata: Metadata = {
  title: 'EDA Forex',
  description: 'EDA Forex simulated client terminal. Backend-authoritative quotes, account, and risk.',
};

export default function ForexLayout({ children }: { children: React.ReactNode }) {
  return <ForexTerminalLayout>{children}</ForexTerminalLayout>;
}
