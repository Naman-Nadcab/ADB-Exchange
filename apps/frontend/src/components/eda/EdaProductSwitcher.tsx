'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { ROUTES, SPOT_TRADE_HREF } from '@/lib/routes';

export function EdaProductSwitcher() {
  const pathname = usePathname() ?? '';
  const inForex = pathname.startsWith('/forex');
  const inCrypto = pathname.startsWith('/trade') || pathname.startsWith('/wallet') || pathname.startsWith('/p2p');
  const context = inForex ? 'Forex' : inCrypto ? 'Crypto' : 'All Markets';

  return (
    <div className="relative group">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md border border-[#F5B8001F] px-2.5 py-1.5 text-[12px] text-[#9CA3AF] hover:text-white"
        aria-haspopup="menu"
        aria-label="Product context"
      >
        <span className="text-white/80">EDA</span>
        <span className="text-[#F5B800]">/</span>
        <span>{context}</span>
      </button>
      <div
        role="menu"
        className="invisible absolute left-0 top-full z-40 mt-1 min-w-[11rem] rounded-lg border border-[#F5B8001F] bg-[#0D1118] py-1 opacity-0 shadow-xl transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        <Link role="menuitem" href={ROUTES.home} className="block px-3 py-2 text-[12px] text-[#9CA3AF] hover:bg-white/5 hover:text-white">
          All Markets
        </Link>
        <Link role="menuitem" href={SPOT_TRADE_HREF} className="block px-3 py-2 text-[12px] text-[#9CA3AF] hover:bg-white/5 hover:text-white">
          Crypto
          <span className="mt-0.5 block text-[10px] text-[#6B7280]">Digital asset trading</span>
        </Link>
        <Link role="menuitem" href={FOREX_ROUTES.trade} className="block px-3 py-2 text-[12px] text-[#9CA3AF] hover:bg-white/5 hover:text-white">
          Forex
          <span className="mt-0.5 block text-[10px] text-[#6B7280]">Global FX trading</span>
        </Link>
      </div>
    </div>
  );
}
