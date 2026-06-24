import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PAGE_METADATA } from '@/lib/seo/pageMetadata';

export const metadata: Metadata = PAGE_METADATA.api;

/** SEO-friendly entry point; API keys are managed in the dashboard. */
export default function ApiRedirectPage() {
  redirect('/dashboard/api');
}
