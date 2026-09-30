import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/pageMetadata';

export const metadata: Metadata = PAGE_METADATA.register;

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
