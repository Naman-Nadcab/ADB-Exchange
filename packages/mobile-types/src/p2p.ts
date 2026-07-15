export type P2PAdType = 'buy' | 'sell';
export type P2PPricingType = 'fixed' | 'floating';
export type P2PAdStatus = 'active' | 'paused' | 'cancelled';

export type P2PAd = {
  id: string;
  user_id?: string;
  ad_type?: string;
  type?: string;
  pricing_type?: P2PPricingType;
  fixed_price?: string;
  float_percentage?: string;
  current_price?: string;
  price?: string;
  min_amount?: string;
  max_amount?: string;
  available_amount: string;
  payment_time_limit?: number;
  username: string;
  crypto_symbol: string;
  crypto_name?: string;
  fiat_currency: string;
  total_orders?: number;
  completed_orders?: number;
  merchant_total_orders?: number;
  merchant_completion_rate?: string | null;
  merchant_rating?: string | null;
  merchant_avg_release_time_minutes?: string | null;
  verified_merchant?: boolean;
  accepted_payment_methods?: string[] | unknown;
  accepted_platform_method_ids?: string[];
  terms_and_conditions?: string;
  remarks?: string;
  auto_reply?: string;
  status?: P2PAdStatus | string;
  created_at?: string;
};

export type P2POrderStatus =
  | 'created'
  | 'escrow_funded'
  | 'payment_pending'
  | 'payment_sent'
  | 'payment_confirmed'
  | 'released'
  | 'cancelled'
  | 'disputed'
  | 'expired'
  | string;

export type P2POrder = {
  id: string;
  ad_id: string;
  buyer_id: string;
  seller_id: string;
  status: P2POrderStatus;
  quantity: string;
  fiat_amount?: string;
  payment_method_id?: string;
  escrow_id?: string;
  expires_at?: string;
  payment_confirmed_at?: string | null;
  released_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  crypto_symbol?: string;
  buyer_username?: string;
  seller_username?: string;
  fiat_currency?: string;
  created_at?: string;
  seller_payment_details?: Record<string, unknown>;
  seller_payment_display_name?: string | null;
  seller_payment_method_name?: string | null;
  seller_payment_method_code?: string | null;
  transaction_reference?: string | null;
  payment_proof_url?: string | null;
  payment_verification_status?: 'pending' | 'verified' | 'rejected' | string | null;
  payment_verified_at?: string | null;
  dispute_id?: string | null;
};

export type P2PPlatformPaymentMethod = {
  id: string;
  name: string;
  code?: string;
  method_type?: string;
};

export type P2PUserPaymentMethod = {
  id: string;
  payment_method_id?: string;
  method_name: string;
  method_code?: string;
  method_type?: string;
  display_name?: string;
  is_active?: boolean;
  is_verified?: boolean;
  is_default?: boolean;
  priority?: number;
  payment_details?: Record<string, unknown>;
  verification_status?: string;
  created_at?: string;
  updated_at?: string;
};

export type P2PMessage = {
  id: string;
  orderId: string;
  senderId: string;
  senderUsername?: string | null;
  message: string;
  createdAt: string;
  /** Client-only pending state */
  _pending?: boolean;
  _clientId?: string;
  _failed?: boolean;
};

export type P2PReferencePrice = {
  asset: string;
  fiat: string;
  reference_price: string;
  market: string | null;
  source: string;
  updated_at: string;
};

export type CreateP2POrderRequest = {
  adId: string;
  quantity: string;
  paymentMethodId: string;
};

export type CreateP2PAdRequest = {
  type: P2PAdType;
  currency: string;
  fiat: string;
  price: string;
  min_amount: string;
  max_amount: string;
  available_amount: string;
  payment_method_ids: string[];
  payment_time_limit?: number;
  auto_release?: boolean;
  remarks?: string;
  auto_reply?: string;
  pricing_type?: P2PPricingType;
  float_margin_percent?: number;
};

export type UpdateP2PAdRequest = {
  price?: string;
  min_amount?: string;
  max_amount?: string;
  available_amount?: string;
  remarks?: string;
  auto_reply?: string;
  status?: 'active' | 'paused';
};

export type P2PDispute = {
  id: string;
  order_id: string;
  initiator_id?: string;
  status: string;
  reason?: string;
  evidence?: string[] | null;
  resolution?: string | null;
  admin_id?: string | null;
  admin_notes?: string | null;
  resolved_at?: string | null;
  payment_context?: Record<string, unknown> | null;
  order_status?: string;
  order_fiat_amount?: string;
  order_quantity?: string;
  order_fiat_currency?: string;
  order_payment_proof_url?: string | null;
  order_transaction_reference?: string | null;
  order_payment_verification_status?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type P2PMerchantStats = {
  total_orders?: number;
  completed_orders?: number;
  completion_rate?: string | number;
  average_rating?: string | number;
  avg_release_time?: string | number;
  [key: string]: unknown;
};
