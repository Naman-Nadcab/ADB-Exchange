import type { RootStackParamList } from './types';

export const linking = {
  prefixes: ['metheorium://', 'https://app.metheorium.com'],
  config: {
    screens: {
      Auth: {
        screens: {
          Welcome: 'auth/welcome',
          LoginMethod: 'auth/login',
          LoginPassword: 'login',
          SignupIdentifier: 'auth/signup',
          SignupReferral: 'referral/:referralCode',
          OAuthCallback: 'oauth/callback',
        },
      },
      Main: {
        screens: {
          Markets: {
            screens: {
              MarketsHome: 'markets',
              PairDetail: 'markets/:symbol',
              MarketSearch: 'markets/search',
            },
          },
          Trade: {
            screens: {
              SpotTrading: 'trade/:symbol?',
              PairSelector: 'trade/pairs',
            },
          },
          Orders: {
            screens: {
              OrdersHome: 'orders',
              OrderHistory: 'orders/history',
              TradeHistory: 'orders/trades',
            },
          },
          Wallet: {
            screens: {
              AssetsHome: 'wallet',
              AssetDetail: 'wallet/:symbol',
              Transfer: 'wallet/transfer',
              Convert: 'wallet/convert',
              DepositHome: 'wallet/deposit',
              DepositAddress: 'wallet/deposit/:symbol',
              WithdrawHome: 'wallet/withdraw',
            },
          },
          P2P: {
            screens: {
              Marketplace: 'p2p',
              OrderRoom: 'p2p/order/:orderId',
            },
          },
        },
      },
      Account: {
        screens: {
          AccountHome: 'account',
          SecurityCenter: 'security',
          KYCHub: 'kyc',
          TicketDetail: 'support/ticket/:id',
          ReferralHome: 'referral',
          Notifications: 'account/notifications',
        },
      },
    },
  },
};

export type DeepLinkPaths = keyof RootStackParamList;
