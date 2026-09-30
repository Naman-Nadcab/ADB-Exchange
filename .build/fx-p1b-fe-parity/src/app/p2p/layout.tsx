import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/pageMetadata';
import P2PShellLayoutClient from './P2PShellLayoutClient';

export const metadata: Metadata = PAGE_METADATA.p2p;

export default function P2PLayout({ children }: { children: React.ReactNode }) {
  return <P2PShellLayoutClient>{children}</P2PShellLayoutClient>;
}
