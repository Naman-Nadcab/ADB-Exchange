'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminSearch } from '@/lib/admin/forex-api';
import { Input } from '@/components/ui/Input';

export function ForexGlobalSearchBar() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [q, setQ] = useState('');
  const enabled = !!token && q.trim().length >= 2;
  const searchQ = useQuery({
    queryKey: ['admin', 'forex', 'search', token, q],
    queryFn: async () => {
      const res = await getForexAdminSearch(token, q.trim());
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Search failed');
      return res.data;
    },
    enabled,
    staleTime: 5_000,
  });

  return (
    <div className="max-w-xl">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Global search (client, order, lead, case…) — min 2 chars"
        className="text-sm"
      />
      {enabled && searchQ.isFetching ? <p className="mt-1 text-xs text-admin-muted">Searching…</p> : null}
      {enabled && searchQ.data?.hits.length ? (
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-admin-border/60 bg-admin-surface/80 text-xs">
          {searchQ.data.hits.map((h) => (
            <li key={`${h.domain}-${h.id}`} className="border-b border-admin-border/40 px-2 py-1.5 last:border-0">
              <Link href={h.href_hint} className="text-violet-200 hover:underline">
                {h.label}
              </Link>
              <span className="ml-2 text-admin-muted">
                {h.domain}
                {h.sublabel ? ` · ${h.sublabel}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
