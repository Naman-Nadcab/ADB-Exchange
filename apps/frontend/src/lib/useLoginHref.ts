'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { loginPathWithRedirect } from '@/lib/authSession';

/** Login link for the page the visitor is on, including the query string. */
export function useLoginHref(): string {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  return loginPathWithRedirect(pathname, search ? `?${search}` : '');
}
