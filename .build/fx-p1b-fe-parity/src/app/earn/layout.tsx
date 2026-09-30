import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/pageMetadata';
import EarnPublicShell from './EarnPublicShell';

export const metadata: Metadata = PAGE_METADATA.earn;

export default function EarnLayout({ children }: { children: React.ReactNode }) {
  return <EarnPublicShell>{children}</EarnPublicShell>;
}
