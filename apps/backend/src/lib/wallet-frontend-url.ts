import { config } from '../config/index.js';
import { resolveWalletFrontendUrl } from '../services/wallet-auth-challenge.service.js';

export function walletFrontendUrl(originHeader: string | string[] | undefined): string {
  return resolveWalletFrontendUrl(config.frontendUrl, originHeader, config.walletBrowserOrigins);
}
