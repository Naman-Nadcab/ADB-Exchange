'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { adminFetch } from '@/lib/api';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useState } from 'react';

type HolidayRow = { calendar_date: string; kind: string; notes: string | null };

export function ForexHolidayCalendarPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const q = useQuery({
    queryKey: ['admin', 'forex', 'holidays', token],
    queryFn: async () => {
      const res = await adminFetch<{ rows: HolidayRow[]; state: { coverage: string } }>('/forex/holidays', { token });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
  });

  const addM = useMutation({
    mutationFn: async () => {
      const res = await adminFetch('/forex/holidays', {
        token,
        method: 'POST',
        body: { date: date.trim(), kind: 'holiday', notes: notes.trim() || undefined },
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Add failed');
    },
    onSuccess: () => {
      setDate('');
      setNotes('');
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'holidays'] });
    },
  });

  return (
    <ForexPanelShell title="Holiday calendar" description="DB-backed dates — coverage CONFIGURED when at least one date exists.">
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge variant={q.data?.state.coverage === 'CONFIGURED' ? 'success' : 'warning'}>
          Coverage: {q.data?.state.coverage ?? '…'}
        </Badge>
      </div>
      <div className="mb-4 grid max-w-md gap-2 sm:grid-cols-3">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="sm:col-span-2" />
        <Button size="sm" disabled={!date || addM.isPending} onClick={() => addM.mutate()}>
          Add holiday
        </Button>
      </div>
      <ul className="admin-stack-sm text-sm">
        {(q.data?.rows ?? []).map((r) => (
          <li key={r.calendar_date} className="flex items-center justify-between rounded border border-admin-border/60 px-3 py-2">
            <span>
              {r.calendar_date} · {r.kind} {r.notes ? `— ${r.notes}` : ''}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await adminFetch(`/forex/holidays/${r.calendar_date}`, { token, method: 'DELETE' });
                void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'holidays'] });
              }}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </ForexPanelShell>
  );
}
