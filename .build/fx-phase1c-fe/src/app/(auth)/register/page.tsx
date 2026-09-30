import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PAGE_METADATA } from '@/lib/seo/pageMetadata';

export const metadata: Metadata = PAGE_METADATA.register;

export default function RegisterRedirectPage() {
  redirect('/signup');
}
