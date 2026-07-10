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

export type ConvertInstantRequest = {
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmount: string;
  accountType?: 'funding' | 'spot' | 'trading';
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
