/**
 * Page metadata resolver — maps pathnames to titles and breadcrumbs.
 */

interface PageMeta {
  title: string;
  breadcrumbs: { label: string; href?: string }[];
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/control-center': 'Control Center',
  '/admin-control': 'Exchange Controls',
  '/monitoring': 'Monitoring',
  '/monitoring/infrastructure': 'Infrastructure Center',
  '/alerts': 'Alert Center',
  '/settings/alert-providers': 'Alert Providers',
  '/monitoring/alert-rules': 'Alert Rules',
  '/incidents': 'Incidents',
  '/operations': 'Operations Hub',
  '/triage': 'Triage Queue',
  '/analytics': 'Analytics',
  '/analytics/scheduled-reports': 'Scheduled Reports',
  '/trading': 'Trading Engine',
  '/markets': 'Markets',
  '/orders': 'Orders',
  '/trades': 'Trades',
  '/liquidity': 'Liquidity',
  '/admin/mm-control': 'MM Desk',
  '/p2p': 'P2P Trading',
  '/wallets': 'Wallets',
  '/treasury': 'Treasury',
  '/treasury/settings': 'Treasury Settings',
  '/deposits': 'Deposits',
  '/withdrawals': 'Withdrawals',
  '/fiat-withdrawals': 'Fiat Withdrawals (INR)',
  '/reconciliation': 'Reconciliation',
  '/fees': 'Fees',
  '/staking': 'Staking & Earn',
  '/risk': 'Risk & AML',
  '/risk/automation': 'Risk Automation',
  '/risk/settings': 'Risk Settings',
  '/risk/severity-settings': 'Severity Levels',
  '/compliance': 'Compliance Reports',
  '/compliance-policy': 'Compliance Policy',
  '/approvals': 'Approvals',
  '/audit': 'Audit Logs',
  '/audit/config': 'Config Changes',
  '/logs': 'System Logs',
  '/users': 'Users',
  '/users/restrictions': 'Restrictions / Bans',
  '/users/referrals': 'Referrals',
  '/users/analytics': 'User Analytics',
  '/kyc': 'KYC Verification',
  '/security': 'Security',
  '/support': 'Support Tickets',
  '/admin-users': 'Admin Users',
  '/notifications': 'Notifications',
  '/announcements': 'Announcements',
  '/integrations': 'Webhooks & Delivery',
  '/settings': 'General Settings',
  '/settings/system': 'System Config',
  '/settings/integrations': 'Compliance Providers',
  '/settings/infrastructure': 'Infrastructure',
  '/settings/auth-notifications': 'Login & Notifications',
  '/settings/nodes': 'Nodes',
  '/backups': 'Backups',
  '/system/page-audit': 'Page & API Audit',
  '/system/integrations': 'Integrations Center',
  '/forex': 'Forex FDM Overview',
  '/forex/command': 'Forex Command Desk',
  '/forex/instruments': 'Forex Instruments',
  '/forex/sessions': 'Forex Sessions & Holidays',
  '/forex/market-data': 'Forex Market Data',
  '/forex/orders': 'Forex Orders',
  '/forex/executions': 'Forex Executions & Fills',
  '/forex/positions': 'Forex Positions',
  '/forex/protection': 'Forex Protection',
  '/forex/margin-risk': 'Forex Margin & Risk',
  '/forex/liquidation': 'Forex Liquidation',
  '/forex/dealing': 'Forex Dealing Desk',
  '/forex/fees-swaps': 'Forex Fees & Swaps',
  '/forex/accounts': 'Forex Accounts',
  '/forex/ledger': 'Forex Ledger & Recon',
  '/forex/controls': 'Forex Global Controls',
  '/forex/lp-execution': 'Forex LP & Execution',
  '/forex/journal-audit': 'Forex Journal & Audit',
  '/forex/system': 'Forex System',
};

export function getPageMeta(pathname: string | null): PageMeta {
  if (!pathname) return { title: 'Admin', breadcrumbs: [{ label: 'Admin' }] };

  const exactTitle = PAGE_TITLES[pathname];
  if (exactTitle) {
    return {
      title: exactTitle,
      breadcrumbs: [
        { label: 'Admin', href: '/dashboard' },
        { label: exactTitle },
      ],
    };
  }

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [{ label: 'Admin', href: '/dashboard' }];
  let path = '';
  for (const seg of segments) {
    path += '/' + seg;
    const label = PAGE_TITLES[path] || seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    breadcrumbs.push({ label, href: path });
  }

  const title = breadcrumbs[breadcrumbs.length - 1]?.label ?? 'Admin';
  return { title, breadcrumbs };
}
