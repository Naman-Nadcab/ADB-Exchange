'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';

export function ForexJsonPanel(props: { title: string; data: unknown; className?: string }) {
  return (
    <Card className={props.className}>
      <CardHeader className="pb-2">
        <h3 className="text-sm font-semibold">{props.title}</h3>
      </CardHeader>
      <CardContent>
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-admin-bg/80 p-3 text-xs text-admin-muted">
          {JSON.stringify(props.data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
