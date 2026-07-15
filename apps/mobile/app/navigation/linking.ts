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
              ConvertConfirm: 'wallet/convert/confirm',
              ConvertHistory: 'wallet/convert/history',
              WalletHistory: {
                path: 'wallet/history',
                parse: {
                  tab: (tab: string) => tab,
                  coin: (coin: string) => coin,
                },
              },
              TransferDetail: 'wallet/transfers/:transferId',
              ConvertDetail: 'wallet/conversions/:conversionId',
              TransactionHistory: 'wallet/transactions',
              DepositHome: 'wallet/deposit',
              DepositNetwork: {
                path: 'wallet/deposit/:symbol',
                parse: {
                  symbol: (symbol: string) => symbol.toUpperCase(),
                },
              },
              WithdrawHome: {
                path: 'wallet/withdraw',
                parse: { coin: (coin: string) => coin },
              },
              FiatWithdraw: 'wallet/withdraw/fiat',
              FiatWithdrawalDetail: 'wallet/fiat/withdrawals/:withdrawalId',
              WalletPnl: 'wallet/pnl',
              WithdrawNetwork: 'wallet/withdraw/:symbol/network',
              WithdrawForm: 'wallet/withdraw/:symbol/form',
              WithdrawalHistory: 'wallet/withdraw/history',
              WithdrawalDetail: 'wallet/withdrawals/:withdrawalId',
            },
          },
          P2P: {
            screens: {
              Marketplace: 'p2p',
              AdDetail: 'p2p/ad/:adId',
              PostAdType: 'p2p/create-ad',
              OrderRoom: 'p2p/orders/:orderId',
              OrdersList: 'p2p/orders',
              PaymentMethods: 'p2p/payment-methods',
              AddPaymentMethod: 'p2p/payment-methods/add',
              MerchantDashboard: 'p2p/merchant-dashboard',
              MerchantProfile: 'p2p/profile/:advertiserId',
              DisputeDetail: 'p2p/disputes/:disputeId',
              MyAds: 'p2p/my-ads',
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
