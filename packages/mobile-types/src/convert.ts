export type ConvertCurrency = {
  id: string;
  symbol: string;
  name: string;
  logo_url?: string;
  decimals: number;
  is_active?: boolean;
};

export type ConvertQuote = {
  from: { symbol: string; name?: string; logo?: string; id?: string; amount: string };
  to: { symbol: string; name?: string; logo?: string; id?: string; amount: string };
  rate: string;
  fee: string;
  expiresIn: number;
};

export type ConvertQuoteSnapshot = {
  toAmount: string;
  rate: string;
  fee: string;
  expiresAtMs: number;
  fromCurrencyId: string;
  toCurrencyId: string;
};

export type ConvertBalance = {
  currency_id: string;
  symbol: string;
  name: string;
  logo_url?: string;
  available_balance: string;
  total_balance: string;
  locked_balance?: string;
};

export type ConvertInstantRequest = {
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmount: string;
  accountType?: 'funding' | 'spot' | 'trading';
};

export type ConvertInstantResult = {
  id?: string;
  conversionId?: string;
  from?: { currency?: string; amount?: string };
  to?: { currency?: string; amount?: string };
  rate?: string;
  status?: string;
};

export type ConvertDustResult = {
  converted_count?: number;
  assetsConverted?: number;
  total_usdt_received?: string;
  totalUsdt?: string;
};

export type ConvertHistoryItem = {
  id: string;
  conversion_type: string;
  from_amount: string;
  to_amount: string;
  conversion_rate: string;
  fee_amount?: string;
  account_type: string;
  status: string;
  created_at: string;
  completed_at?: string;
  from_symbol: string;
  to_symbol: string;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
