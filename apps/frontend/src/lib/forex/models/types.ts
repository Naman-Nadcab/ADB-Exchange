/** Public Forex DTOs — shapes verified from Phase 9.6 backend source. */

export type ForexQuoteQuality = 'OK' | 'STALE' | 'CROSSED' | 'HALTED' | 'SIMULATED';
export type ForexQuoteSource = 'LIVE' | 'SIMULATED';
export type ForexFreshness = 'FRESH' | 'STALE';
export type ForexQuoteStatus = 'TRADEABLE' | 'HALTED' | 'REJECTED' | 'UNAVAILABLE';
export type ForexTradingStatus = 'active' | 'halted' | 'closed';
export type ForexAssetClass = 'fx_major' | 'fx_cross' | 'metal';
export type ForexProviderHealthStatus = 'HEALTHY' | 'DEGRADED' | 'STALE' | 'OFFLINE';
export type ForexSessionName = 'Sydney' | 'Tokyo' | 'London' | 'New York';
export type ForexHolidayCoverage = 'UNCONFIGURED' | 'CONFIGURED';
export type ForexAccountRiskState = 'NORMAL' | 'WARNING' | 'RESTRICTED' | 'LIQUIDATION_ONLY' | 'HALTED';
export type ForexMarginStatus = 'NORMAL' | 'WARNING' | 'MARGIN_CALL' | 'STOP_OUT_READY';
export type ForexOrderState =
  | 'NEW'
  | 'VALIDATING'
  | 'ACCEPTED'
  | 'PENDING'
  | 'TRIGGERING'
  | 'ROUTING'
  | 'SUBMITTED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'REJECTED'
  | 'CANCEL_PENDING'
  | 'CANCELLED'
  | 'FAILED';
export type ForexPositionSide = 'long' | 'short';
export type ForexPositionStatus = 'OPEN' | 'CLOSED';
export type ForexProtectionType = 'STOP_LOSS' | 'TAKE_PROFIT';
export type ForexProtectionState =
  | 'ACTIVE'
  | 'TRIGGERING'
  | 'TRIGGERED'
  | 'EXECUTING'
  | 'FILLED'
  | 'CANCELLED'
  | 'FAILED';
export type ForexOrderType = 'market' | 'limit' | 'stop';
export type ForexSide = 'buy' | 'sell';
export type ForexConnectionState =
  | 'CONNECTED'
  | 'CONNECTING'
  | 'RECONNECTING'
  | 'DEGRADED'
  | 'STALE'
  | 'DISCONNECTED';
export type ForexWorkspaceId = 'trading' | 'analysis' | 'portfolio' | 'custom';

export interface ForexInstrument {
  id: string;
  symbol: string;
  displaySymbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  assetClass: ForexAssetClass;
  digits: number;
  pricePrecision: number;
  pipSize: string;
  tickSize: string;
  contractSize: string;
  minVolume: string;
  maxVolume: string;
  volumeStep: string;
  tradingStatus: ForexTradingStatus;
  sessionCalendarId: string;
  maxLeverage: string;
  marginPercent: string;
  commission: string;
  commissionType: string;
  swapLong: string;
  swapShort: string;
  swap3day: string;
}

export interface ForexQuoteDto {
  symbol: string;
  displaySymbol: string;
  instrumentId: string;
  bid: string;
  ask: string;
  mid: string;
  spread: string;
  spreadPips: string;
  spreadTicks: string;
  providerId: string;
  providerCode: string;
  providerTimestamp: string;
  receivedTimestamp: string;
  sequence: string;
  edaReceiveSequence: string;
  quality: ForexQuoteQuality;
  status: ForexQuoteStatus;
  source: ForexQuoteSource;
  freshness: ForexFreshness;
}

export interface ForexProviderHealth {
  providerId?: string;
  providerCode?: string;
  status: ForexProviderHealthStatus;
  [key: string]: unknown;
}

export interface ForexSessionEligibility {
  open: boolean;
  reason:
    | 'OPEN'
    | 'WEEKEND_CLOSURE'
    | 'FRIDAY_CLOSE'
    | 'HOLIDAY_CLOSURE'
    | 'HOLIDAY_UNCONFIGURED'
    | 'OUTSIDE_SESSION';
  sessions: ForexSessionName[];
  overlaps: Array<[ForexSessionName, ForexSessionName]>;
  weekend: boolean;
  holiday: boolean;
  holidayCoverage: ForexHolidayCoverage;
  holidayRequired: boolean;
  holidaySafe: boolean;
  dstApplied: boolean;
  timezone: string;
  timestamp: string;
  source: 'SIMULATED';
}

export interface ForexSessionSnapshot {
  source: 'SIMULATED';
  calendar: { id: string; code: string; name: string; timezone: string };
  sessions: ForexSessionName[];
  eligibility: ForexSessionEligibility;
  holidayCoverage: ForexHolidayCoverage;
  holidayRequired: boolean;
  holidaySafe: boolean;
  exceptionsConfigured: number;
  dstApplied: boolean;
  dstModel: string;
  weekendTimezone: string;
  valuationPolicy?: Record<string, unknown>;
}

export interface ForexTradingConfig {
  source: 'SIMULATED';
  executionMode: 'MOCK';
  orderTypes: ForexOrderType[];
  sessions: ForexSessionSnapshot;
  fees: { global?: unknown; model?: string };
  swaps: { rolloverTime?: string; timezone?: string };
  leverage: { globalMax?: string; defaultAccount?: string };
  holiday: {
    coverage: ForexHolidayCoverage;
    required: boolean;
    holidaySafe: boolean;
    dstApplied: boolean;
  };
}

export interface ForexAccountView {
  accountId: string;
  currency: 'USD' | string;
  ledgerBalance: string;
  availableBalance: string;
  equity: string;
  usedMargin: string;
  freeMargin: string;
  marginLevel: string | null;
  unrealizedPnl: string;
  realizedPnl: string;
  timestamp: string;
  source: 'SIMULATED';
  calculationStatus: string;
  valuationKind: 'CALCULATED' | string;
  priceSource: string;
  conversionSource: string;
}

export interface ForexMarginSnapshot {
  accountId: string;
  balanceReference: string;
  equityReference: string;
  usedMargin: string;
  maintenanceMargin: string;
  freeMargin: string;
  marginLevel: string | null;
  effectiveLeverage: string;
  totalExposure: string;
  grossExposure: string;
  netExposure: string;
  symbolExposures: Record<string, string>;
  status: ForexMarginStatus;
  ledgerBalance?: string;
  unrealizedPnl?: string;
  calculationStatus?: string;
  source: 'SIMULATED';
  valuationKind: 'CALCULATED';
  timestamp: string;
}

export interface ForexDealingSnapshot {
  emergencyHalt: boolean;
  emergencyAllowRiskReduction: boolean;
  symbol: {
    enabled: boolean;
    buyEnabled: boolean;
    sellEnabled: boolean;
    newOrderEnabled: boolean;
    riskReductionEnabled: boolean;
  };
  account: {
    enabled: boolean;
    newOrderEnabled: boolean;
    riskReductionEnabled: boolean;
  };
  source: 'SIMULATED';
}

export interface ForexRiskStatus {
  source: 'SIMULATED';
  executionMode: 'MOCK';
  valuationKind: 'CALCULATED';
  state: ForexAccountRiskState;
  reason: string | null;
  liquidationLock: boolean;
  dealing: ForexDealingSnapshot;
  limits?: unknown;
  exposure?: ForexExposure;
  margin?: {
    equity: string;
    usedMargin: string;
    maintenanceMargin: string;
    freeMargin: string;
    marginUtilization: string;
    marginLevel: string | null;
  };
  policy?: unknown;
  updatedAt?: string;
}

export interface ForexExposure {
  source?: 'SIMULATED';
  executionMode?: 'MOCK';
  valuationKind?: 'CALCULATED';
  accountId?: string;
  accountNet?: string;
  gross?: string;
  net?: string;
  [key: string]: unknown;
}

export interface ForexPnlView {
  realized: string;
  unrealized: string;
  total: string;
  currency: string;
  valuationTimestamp: string;
  priceSource: string;
  conversionSource: string;
  status: string;
  source: 'SIMULATED';
  positions?: unknown[];
}

export interface ForexPublicOrder {
  orderId: string;
  clientOrderId: string;
  clientExecId: string;
  symbol: string;
  side: ForexSide;
  type: ForexOrderType;
  requestedVolume: string;
  filledVolume: string;
  remainingVolume: string;
  requestedPrice: string | null;
  status: ForexOrderState;
  failureReason: string | null;
  executionId: string | null;
  version: number;
  source: 'SIMULATED';
  executionMode: 'MOCK';
  createdAt: string;
  updatedAt: string;
}

export interface ForexPublicPosition {
  positionId: string;
  symbol: string;
  side: ForexPositionSide;
  volume: string;
  entryPrice: string;
  averageEntryPrice: string;
  currentPrice: string;
  contractSize: string;
  leverage: string;
  initialMargin: string;
  maintenanceMargin: string;
  exposure: string;
  status: ForexPositionStatus;
  mode: string;
  version: number;
  source: 'SIMULATED';
  valuationKind: 'CALCULATED';
  openedAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface ForexPublicProtection {
  protectionId: string;
  clientProtectionId: string;
  positionId: string;
  symbol: string;
  positionSide: ForexPositionSide;
  type: ForexProtectionType;
  volume: string;
  triggerPrice: string;
  status: ForexProtectionState;
  lastEvalPrice: string | null;
  lastEvalSource: 'BID' | 'ASK' | null;
  orderId: string | null;
  failureReason: string | null;
  source: 'SIMULATED';
  executionMode?: 'MOCK';
}

export interface ForexFillRow {
  fillId: string;
  orderId: string;
  symbol: string;
  side: string;
  volume: string;
  price: string;
  timestamp: string;
  source: 'SIMULATED';
  executionId?: string;
}

export interface ForexLedgerRow {
  transactionId: string;
  type: string;
  debit: string;
  credit: string;
  currency: string;
  reference?: unknown;
  timestamp: string;
  status: string;
  source: string;
}

export interface ForexError {
  code: string;
  message: string;
  source?: string;
}

export interface ForexPlaceOrderBody {
  clientOrderId: string;
  symbol: string;
  side: ForexSide;
  orderType: ForexOrderType;
  volume: string;
  requestedPrice?: string;
  maxSlippage?: string;
  maxDeviation?: string;
}

export const FOREX_SESSION_NAMES: ForexSessionName[] = ['Sydney', 'Tokyo', 'London', 'New York'];
export const FOREX_PREFIX = '/api/v1/forex';
export const FOREX_WS_PATH = '/api/v1/forex/ws';
export const FOREX_WS_PROTOCOL = 'eda.forex.ws.v1';
