import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/pageMetadata';
import { EdaHomeGate } from '@/components/eda/EdaHomeGate';

export const metadata: Metadata = PAGE_METADATA.home;

export default function HomePage() {
  return <EdaHomeGate />;
}
