import test from 'node:test';
import assert from 'node:assert/strict';
import { isMobileWalletBrowser, mobileWalletHandoffs } from './mobile-wallet-handoff';

const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const desktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

test('a desktop browser gets no wallet handoff', () => {
  assert.equal(isMobileWalletBrowser(desktop), false);
  assert.deepEqual(mobileWalletHandoffs(desktop, 'https://169.58.39.2/login'), []);
});

test('a phone browser gets links that open this page inside a wallet', () => {
  const links = mobileWalletHandoffs(iphone, 'https://169.58.39.2/login?returnUrl=%2Fdashboard');
  assert.deepEqual(links.map((item) => item.name), ['MetaMask', 'Trust Wallet', 'Coinbase Wallet', 'Phantom']);
  assert.equal(links[0]?.href, 'https://metamask.app.link/dapp/169.58.39.2/login?returnUrl=%2Fdashboard');
  assert.equal(
    links[1]?.href,
    'https://link.trustwallet.com/open_url?coin_id=60&url=https%3A%2F%2F169.58.39.2%2Flogin%3FreturnUrl%3D%252Fdashboard',
  );
  assert.equal(links[2]?.href.startsWith('https://go.cb-w.com/dapp?cb_url='), true);
  assert.equal(links[3]?.namespace, 'solana');
});
