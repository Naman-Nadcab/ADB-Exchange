import type { RootStackParamList } from './types';

export const linking = {
  prefixes: ['metheorium://', 'https://app.metheorium.com'],
  config: {
    screens: {
      Auth: {
        screens: {
          Welcome: 'auth/welcome',
          LoginPassword: 'login',
          LoginIdentifier: 'login/otp',
          ForgotPasswordRequest: 'forgot-password',
          SignupIdentifier: 'signup',
          SignupReferral: 'signup/ref/:referralCode',
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
              TransferConfirm: 'wallet/transfer/confirm',
              TransferHistory: 'wallet/transfer/history',
              Convert: 'wallet/convert',
              DepositHome: 'wallet/deposit',
              DepositAddress: 'wallet/deposit/:symbol',
              WithdrawHome: {
                path: 'wallet/withdraw',
                parse: { coin: (coin: string) => coin },
              },
              WithdrawNetwork: 'wallet/withdraw/:symbol/network',
              WithdrawForm: 'wallet/withdraw/:symbol/form',
              WithdrawalHistory: 'wallet/withdraw/history',
              WithdrawalDetail: 'wallet/withdrawals/:withdrawalId',
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
          Preferences: 'account/preferences',
          HelpFaq: 'account/help',
          About: 'account/about',
          LegalViewer: 'account/legal/:doc',
          SystemStatus: 'account/status',
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
