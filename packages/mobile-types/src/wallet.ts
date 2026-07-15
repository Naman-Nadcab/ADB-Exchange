export type AccountType = 'funding' | 'spot' | 'trading';

export type EquityTotal = { usd: string; btc?: string };

export type BalanceSummary = {
  funding: { type: 'funding'; totalUsd: string; totalBtc: string };
  trading: { type: 'trading'; totalUsd: string; totalBtc: string };
  total: { totalUsd: string; totalBtc: string };
  btc_usd_price?: string;
};

export type AssetBalance = {
  token_id?: string;
  symbol: string;
  name: string;
  total_balance: string;
  available_balance: string;
  locked_balance: string;
  usd_value: string;
  btc_value?: string;
};

export type FundingBalances = {
  balances: AssetBalance[];
  totalEquity: EquityTotal;
  availableBalance: EquityTotal;
  inUse: EquityTotal;
  btc_usd_price?: string;
};

export type TradingBalance = {
  symbol: string;
  equity: string;
  wallet_balance?: string;
  name?: string;
};

export type SpotTradingBalances = {
  balances: TradingBalance[];
  totalEquity?: EquityTotal;
};

export type TransferableToken = {
  tokenId: string;
  symbol: string;
  name: string;
  iconUrl?: string;
  decimals: number;
  availableBalance: string;
};

export type TransferRequest = {
  fromAccount: AccountType;
  toAccount: AccountType;
  tokenId: string;
  amount: string;
};

export type TransferResult = {
  transferId?: string;
  fromAccount: string;
  toAccount: string;
  amount: string;
  symbol: string;
};

export type TransferHistoryItem = {
  id: string;
  fromAccount: string;
  toAccount: string;
  description: string;
  amount: string;
  symbol: string;
  status: string;
  createdAt: string;
  direction: 'sent' | 'received';
};

export type PortfolioHistoryPoint = {
  timestamp: string;
  total_usd: number;
};

export type PnlAsset = {
  symbol: string;
  pnl: number;
  pnlPercent: number;
  avgBuyPrice: number;
  currentPrice: number;
  quantity: number;
};

export type PnlSummary = {
  totalPnl: number;
  totalPnlPercent: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
  assets: PnlAsset[];
};

export type LedgerEntry = {
  id: string;
  type: 'deposit' | 'withdrawal' | 'internal_transfer' | 'convert' | 'spot_trade';
  asset: string;
  amount: string;
  fee: string;
  direction: 'in' | 'out';
  status: string;
  displayStatus: string;
  reference_id: string;
  created_at: string;
};

export type FundHistoryItem = {
  id: string;
  kind: 'deposit' | 'withdrawal';
  asset: string;
  amount: string;
  status: string;
  displayStatus: string;
  created_at: string;
};

export type CoinInfo = {
  symbol: string;
  name?: string;
  description?: string;
  image?: string;
  market_cap?: number;
  market_cap_rank?: number | null;
  current_price?: number;
  price_change_24h?: number;
  price_change_percentage_24h?: number;
  total_volume?: number;
  circulating_supply?: number;
  total_supply?: number | null;
  max_supply?: number | null;
  ath?: number;
  ath_date?: string;
  atl?: number;
  atl_date?: string;
  homepage?: string;
  blockchain_site?: string;
};

export type WalletChain = {
  id: string;
  name: string;
  type: string;
  native_currency?: string;
  confirmations_required?: number;
  explorer_url?: string;
  is_active?: boolean;
};

export type DepositToken = {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  is_active?: boolean;
  is_native?: boolean;
  min_deposit?: string;
  min_withdrawal?: string;
  withdrawal_fee?: string;
};

export type DepositAddress = {
  address: string;
  chain: {
    id: string;
    name: string;
    type: string;
    confirmationsRequired: number;
    explorerUrl?: string;
  };
  qrCodeData: string;
  notice: string;
  memo?: string;
};

export type DepositRecord = {
  id: string;
  tx_hash?: string;
  amount: string;
  symbol: string;
  token_name?: string;
  chain_name?: string;
  confirmations?: number;
  required_confirmations?: number;
  status: string;
  created_at: string;
  credited_at?: string;
};

export type DepositDetail = {
  id: string;
  txHash: string;
  fromAddress?: string;
  toAddress?: string;
  amount: string;
  symbol: string;
  currencyName?: string;
  chainName?: string;
  confirmations: number;
  requiredConfirmations: number;
  status: string;
  createdAt: string;
  creditedAt?: string;
};

export type WalletKycStatus = {
  verified: boolean;
  status: string;
  level?: number;
  message?: string;
};

export type WithdrawalFeeInfo = {
  fee: string;
  minWithdrawal: string;
  decimals: number;
  chainName: string;
};

export type WithdrawPreview = {
  fee: string;
  net_amount: string;
  min_withdrawal: string;
  fee_exceeds_amount?: boolean;
};

export type CreateWithdrawRequest = {
  symbol: string;
  chainId: string;
  amount: string;
  toAddress: string;
  memo?: string;
  accountType?: AccountType;
  twoFactorCode?: string;
  fund_password?: string;
  withdrawalAddressId?: string;
  type?: 'onchain';
};

export type WithdrawalRecord = {
  id: string;
  asset?: string;
  symbol?: string;
  amount?: string;
  quantity?: string;
  fee?: string;
  netAmount?: string;
  net_amount?: string;
  toAddress?: string;
  address?: string;
  chain?: string;
  chain_name?: string;
  status: string;
  displayStatus?: string;
  createdAt?: string;
  date_time?: string;
  tx_hash?: string;
  txid?: string;
  type?: string;
};

export type WithdrawalDetail = WithdrawalRecord & {
  confirmations?: number;
  required_confirmations?: number;
  displayStatus?: string;
};

/** Normalized row from GET /wallet/transactions/all */
export type WalletRecentTransaction = {
  id: string;
  type: 'deposit' | 'withdrawal' | 'transfer';
  symbol: string;
  amount: string;
  status: string;
  created_at: string;
  chain_type?: string;
};
