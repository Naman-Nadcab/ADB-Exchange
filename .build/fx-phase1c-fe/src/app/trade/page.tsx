import { redirect } from 'next/navigation';

/**
 * Redirect /trade → canonical spot terminal.
 */
export default function TradeRedirectPage() {
  redirect('/trade/spot');
}
