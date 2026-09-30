import Link from 'next/link';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { SPOT_TRADE_HREF } from '@/lib/routes';

/**
 * Home-only product discovery. Lives outside HomePageClient so dirty Crypto home
 * work is not overwritten. Visual language matches the existing Home dark shell.
 * No fake Forex statistics.
 */
export function HomeForexProductPair() {
  return (
    <section
      aria-labelledby="home-trading-products-heading"
      className="border-b border-[#F5B8001F] bg-[#05070B] text-white"
    >
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#F5B800]">Products</p>
        <h2 id="home-trading-products-heading" className="mt-1 text-xl font-semibold sm:text-2xl">
          Choose a market
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[#9CA3AF]">
          Crypto Spot and Forex are separate products. Forex uses its own prices, account, and risk.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <article className="flex flex-col rounded-2xl border border-[#F5B8001F] bg-[#0D1118] p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#9CA3AF]">Crypto</p>
            <h3 className="mt-2 text-lg font-semibold">Crypto Spot</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-[#9CA3AF]">Trade crypto spot markets.</p>
            <Link
              href={SPOT_TRADE_HREF}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg border border-[#F5B8001F] bg-[#0D1118] px-5 py-2.5 text-sm font-semibold text-white transition hover:border-[#F5B80066] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B800]"
            >
              Trade Spot
            </Link>
          </article>
          <article className="flex flex-col rounded-2xl border border-[#F5B8001F] bg-[#0D1118] p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#9CA3AF]">Forex</p>
            <h3 className="mt-2 text-lg font-semibold">Forex</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-[#9CA3AF]">Trade global FX markets.</p>
            <Link
              href={FOREX_ROUTES.root}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#F5B800] px-5 py-2.5 text-sm font-semibold text-[#05070B] transition hover:bg-[#FFD54A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B800]"
            >
              Open Forex
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
