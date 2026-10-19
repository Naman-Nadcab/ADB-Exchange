'use client';

import Link from 'next/link';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';

const ROWS = [
  {
    where: 'System → Global Controls',
    href: '/forex/controls',
    control: 'Order types and book mode',
    effect: 'The customer ticket hides a type you turn off. Fills stay simulated.',
  },
  {
    where: 'Markets → Instruments',
    href: '/forex/instruments',
    control: 'Symbol contract',
    effect: 'Open the eye on a symbol. Digits, pip, size, commission, and swap apply to that symbol only.',
  },
  {
    where: 'Markets → Sessions & Holidays',
    href: '/forex/sessions',
    control: 'Symbol hours',
    effect: 'Blank times keep the 24x5 week. A closed window rejects new orders and leaves bid and ask unchanged.',
  },
  {
    where: 'Accounts → Account Groups',
    href: '/forex/account-groups',
    control: 'Group leverage and risk',
    effect: 'Leverage, hedging or netting, and max size apply to accounts in that group.',
  },
  {
    where: 'Trading → Orders',
    href: '/forex/orders',
    control: 'Place or edit an order',
    effect: 'Place for client, or open a pending order to change price and volume.',
  },
  {
    where: 'Trading → Positions',
    href: '/forex/positions',
    control: 'Close, stop, and trail',
    effect: 'Open a position. Trail distance is saved with Set SL.',
  },
  {
    where: 'Finance → CRM Finance',
    href: '/forex/crm/finance',
    control: 'Credit, debit, or fee',
    effect: 'The request waits for approval. It does not send a withdrawal.',
  },
] as const;

export function ForexDeskMap() {
  return (
    <ForexPanelShell
      title="Where each control lives"
      description="Open the page, change that one thing, and save. Customer fills stay simulated."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-xs">
          <thead>
            <tr className="border-b border-admin-border/70 text-[10px] uppercase tracking-wide text-admin-muted">
              <th className="px-2 py-2 font-medium">Open</th>
              <th className="px-2 py-2 font-medium">Control</th>
              <th className="px-2 py-2 font-medium">What changes</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.href} className="border-b border-admin-border/40 last:border-0">
                <td className="px-2 py-2">
                  <Link href={row.href} className="text-violet-200 hover:underline">
                    {row.where}
                  </Link>
                </td>
                <td className="px-2 py-2 text-foreground">{row.control}</td>
                <td className="px-2 py-2 text-admin-muted">{row.effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ForexPanelShell>
  );
}
