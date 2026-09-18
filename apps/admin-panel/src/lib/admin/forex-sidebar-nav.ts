import type { LucideIcon } from 'lucide-react';
import { FOREX_NAV_GROUPS, forexRoutesInGroup, type ForexNavGroupId } from '@/lib/admin/forex-nav-groups';

export type ForexSidebarNavGroup = {
  id: ForexNavGroupId;
  label: string;
  items: { label: string; href: string; icon: LucideIcon }[];
};

/** Collapsible Forex groups for the primary UnifiedSidebar (single sidebar rule). */
export function buildForexSidebarNavGroups(): ForexSidebarNavGroup[] {
  return FOREX_NAV_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    items: forexRoutesInGroup(g.id).map((r) => ({
      label: r.label,
      href: r.href,
      icon: r.icon,
    })),
  }));
}
