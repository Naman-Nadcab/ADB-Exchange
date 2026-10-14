'use client';

import Link from 'next/link';
import { ADMIN_SURFACE_LABEL, BRAND_NAME_FULL } from '@/lib/brand';

type AdminBrandLogoProps = {
  collapsed?: boolean;
  href?: string;
};

export function AdminBrandLogo({ collapsed = false, href = '/dashboard' }: AdminBrandLogoProps) {
  if (collapsed) {
    return (
      <Link
        href={href}
        className="hidden lg:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-[#111827] text-[11px] font-semibold tracking-wide text-[#E8B923]"
        aria-label={`${BRAND_NAME_FULL} ${ADMIN_SURFACE_LABEL}`}
      >
        ADB
      </Link>
    );
  }

  return (
    <Link href={href} className="inline-flex min-w-0 shrink-0 flex-col justify-center leading-none">
      <span className="text-[15px] font-semibold tracking-tight text-white sm:text-lg">
        <span className="text-[#E8B923]">ADB</span> Exchange
      </span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
        {ADMIN_SURFACE_LABEL}
      </span>
    </Link>
  );
}
