'use client';

import { useState } from 'react';
import { ChevronDown, Code2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Collapsed-by-default raw API payload — operators use structured panels above. */
export function ForexDebugPayload(props: { label?: string; data: unknown; className?: string }) {
  const [open, setOpen] = useState(false);
  if (props.data == null) return null;

  return (
    <div className={cn('rounded-xl border border-dashed border-admin-border/60 bg-admin-bg/40', props.className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs text-admin-muted hover:text-foreground"
      >
        <span className="flex items-center gap-2 font-medium">
          <Code2 className="h-3.5 w-3.5 opacity-70" />
          {props.label ?? 'Developer: raw API payload'}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <pre className="max-h-[360px] overflow-auto border-t border-admin-border/50 p-3 text-[11px] leading-relaxed text-admin-muted">
          {JSON.stringify(props.data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
