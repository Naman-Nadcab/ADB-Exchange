'use client';

import Link from 'next/link';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { ForexControlGrid } from '@/components/forex/ForexControlGrid';
import { FOREX_ADMIN_PHASES, FOREX_ADMIN_ROUTES } from '@/lib/admin/forex-admin-nav';
import { FOREX_CONTROL_GROUPS } from '@/lib/admin/forex-control-registry';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ChevronRight } from 'lucide-react';

export default function ForexAdminOverviewPage() {
  return (
    <AdminPageFrame
      title="Forex FDM Overview"
      description="Maximum control map for the isolated Forex product line. Sidebar + tab nav cover every domain; API wiring rolls out in phases F1–F6."
      status="active"
    >
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Rollout phases</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {FOREX_ADMIN_PHASES.map((p) => (
            <Card key={p.id} className="border-admin-border bg-admin-card/90">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.title}</span>
                  <Badge variant={p.id === 'F0' ? 'success' : 'default'}>{p.id}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-admin-muted">{p.summary}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">All admin sections</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FOREX_ADMIN_ROUTES.filter((r) => r.id !== 'overview').map((r) => {
            const Icon = r.icon;
            return (
              <Link
                key={r.id}
                href={r.href}
                className="group flex items-center gap-3 rounded-xl border border-admin-border bg-admin-card/50 p-3 transition hover:border-violet-500/40 hover:bg-violet-500/5"
              >
                <Icon className="h-5 w-5 text-violet-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.label}</p>
                  <p className="truncate text-xs text-admin-muted">{r.phase}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-admin-muted group-hover:text-violet-300" />
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Full control catalog</h2>
        <ForexControlGrid groups={FOREX_CONTROL_GROUPS} />
      </section>
    </AdminPageFrame>
  );
}
