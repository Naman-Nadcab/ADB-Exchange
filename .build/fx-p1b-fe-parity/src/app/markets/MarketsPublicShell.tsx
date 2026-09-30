'use client';

import { PublicLayout } from '@/components/layout/PublicLayout';

export default function MarketsPublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicLayout contentClassName="min-h-[calc(100vh-3.5rem)]">{children}</PublicLayout>;
}
