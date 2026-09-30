'use client';

import Link from 'next/link';
import { type LucideIcon, Inbox } from 'lucide-react';

export interface EmptyStateProps {
  /** Icon to show (default: Inbox) */
  icon?: LucideIcon;
  /** Short title, e.g. "No orders yet" */
  title: string;
  /** Optional longer description */
  description?: string;
  /** Optional CTA: { label, href } */
  action?: { label: string; href: string };
  /** Optional CTA as button (e.g. "Place first order") */
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  actionLabel,
  actionHref,
  className = '',
}: EmptyStateProps) {
  const href = action?.href ?? actionHref;
  const label = action?.label ?? actionLabel;

  return (
    <div
      className={`state-surface state-empty flex flex-col items-center justify-center px-4 py-10 text-center ${className}`}
      role="status"
      aria-label={title}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="w-7 h-7" aria-hidden />
      </div>
      <h3 className="mb-1 text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="dashboard-muted mb-4 max-w-sm">
          {description}
        </p>
      )}
      {href && label && (
        <Link
          href={href}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary hover:bg-primary/85 text-primary-foreground text-sm font-medium transition-colors"
        >
          {label}
        </Link>
      )}
    </div>
  );
}
