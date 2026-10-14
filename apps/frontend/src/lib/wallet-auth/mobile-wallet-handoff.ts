export type MobileWalletHandoff = {
  id: string;
  name: string;
  namespace: 'eip155' | 'solana';
  href: string;
};

/** Wallet in-app browsers reject the IP certificate. This name resolves to that same server. */
export const WALLET_BROWSER_ORIGIN = 'https://169.58.39.2.sslip.io';

export function isMobileWalletBrowser(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
}

function walletBrowserUrl(pageUrl: URL): string {
  if (pageUrl.hostname !== '169.58.39.2') return pageUrl.toString();
  const alias = new URL(WALLET_BROWSER_ORIGIN);
  const next = new URL(pageUrl.toString());
  next.protocol = alias.protocol;
  next.hostname = alias.hostname;
  next.port = alias.port;
  return next.toString();
}

/** Phone browsers do not expose an installed wallet. These links open this page inside the wallet app. */
export function mobileWalletHandoffs(userAgent: string, pageUrl: string): MobileWalletHandoff[] {
  if (!isMobileWalletBrowser(userAgent)) return [];
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return [];
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return [];
  const absolute = walletBrowserUrl(url);
  const opened = new URL(absolute);
  const encoded = encodeURIComponent(absolute);
  const dappPath = `${opened.host}${opened.pathname}${opened.search}`;
  return [
    {
      id: 'mobile:metamask',
      name: 'MetaMask',
      namespace: 'eip155',
      href: `https://metamask.app.link/dapp/${dappPath}`,
    },
    {
      id: 'mobile:trust',
      name: 'Trust Wallet',
      namespace: 'eip155',
      href: `https://link.trustwallet.com/open_url?coin_id=60&url=${encoded}`,
    },
    {
      id: 'mobile:coinbase',
      name: 'Coinbase Wallet',
      namespace: 'eip155',
      href: `https://go.cb-w.com/dapp?cb_url=${encoded}`,
    },
    {
      id: 'mobile:phantom',
      name: 'Phantom',
      namespace: 'solana',
      href: `https://phantom.app/ul/browse/${encoded}?ref=${encodeURIComponent(opened.origin)}`,
    },
  ];
}
