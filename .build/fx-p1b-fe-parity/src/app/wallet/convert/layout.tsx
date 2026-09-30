import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/pageMetadata';

export const metadata: Metadata = PAGE_METADATA.convert;

export default function ConvertLayout({ children }: { children: React.ReactNode }) {
  return children;
}
