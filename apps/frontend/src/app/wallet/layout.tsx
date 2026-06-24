import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/pageMetadata';
import DashboardLayout from '../dashboard/layout';

export const metadata: Metadata = PAGE_METADATA.wallet;

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
