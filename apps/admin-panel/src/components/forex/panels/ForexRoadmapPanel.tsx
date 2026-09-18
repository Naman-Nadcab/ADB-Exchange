'use client';

import Link from 'next/link';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexEmptyState } from '@/components/forex/primitives/ForexEmptyState';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowRight, Construction } from 'lucide-react';

export function ForexRoadmapPanel(props: {
  title: string;
  summary: string;
  relatedLinks?: { label: string; href: string }[];
}) {
  return (
    <div className="admin-stack-md">
      <ForexEmptyState
        title={props.title}
        description={props.summary}
        icon={Construction}
        action={
          <Badge variant="info" className="font-normal">
            Coming in a future release
          </Badge>
        }
      />

      {props.relatedLinks?.length ? (
        <ForexPanelShell title="Use these desks today" description="Live data and controls while this module is in development">
          <div className="flex flex-wrap gap-2">
            {props.relatedLinks.map((l) => (
              <Link key={l.href} href={l.href}>
                <Button type="button" variant="secondary" size="sm" className="gap-1">
                  {l.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ))}
          </div>
        </ForexPanelShell>
      ) : null}
    </div>
  );
}
