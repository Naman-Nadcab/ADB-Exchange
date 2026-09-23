/** Customer server alert types (mirror backend ALLOWED set). */
export const FOREX_SERVER_ALERT_TYPES = [
  'BID',
  'ASK',
  'PRICE',
  'SPREAD',
  'MARGIN',
  'DRAWDOWN',
  'ORDER_FILLED',
  'PENDING_TRIGGERED',
  'SL_TRIGGERED',
  'TP_TRIGGERED',
  'TRAILING_TRIGGERED',
  'LIQUIDATION',
  'SESSION_OPEN',
  'SESSION_CLOSE',
] as const;

export type ForexServerAlertType = (typeof FOREX_SERVER_ALERT_TYPES)[number];

export type ForexServerAlertRow = {
  alertId: string;
  alertType: string;
  symbol: string | null;
  condition: Record<string, unknown>;
  enabled: boolean;
  cooldownSeconds: number;
  lastTriggeredAt: string | null;
};

export type ForexServerAlertEvent = {
  eventId: string;
  alertId: string;
  deliveryChannel: string;
  status: string;
  message: string;
  createdAt: string;
};

export type ForexAlertTranslate = (key: string, values?: Record<string, string | number>) => string;

export function labelForexServerAlertType(alertType: string, tf?: ForexAlertTranslate): string {
  if (tf) {
    const key = `types.${alertType}`;
    const labeled = tf(key);
    if (labeled !== key) return labeled;
  }
  return alertType.replace(/_/g, ' ');
}

export function describeAlertCondition(
  type: string,
  condition: Record<string, unknown>,
  tf?: ForexAlertTranslate
): string {
  const side = condition.side != null ? String(condition.side) : '';
  const price = condition.price ?? condition.level ?? condition.threshold;
  if (type === 'SESSION_OPEN' || type === 'SESSION_CLOSE') {
    return tf ? tf('conditionSession') : 'fires on authoritative session transition';
  }
  if (
    type === 'ORDER_FILLED' ||
    type === 'PENDING_TRIGGERED' ||
    type === 'SL_TRIGGERED' ||
    type === 'TP_TRIGGERED' ||
    type === 'TRAILING_TRIGGERED'
  ) {
    return tf ? tf('conditionAccountHook') : 'account event hook';
  }
  if (type === 'LIQUIDATION') {
    return tf ? tf('conditionLiquidation') : 'liquidation eligibility hook';
  }
  if (price != null && String(price) !== '') {
    return `${side ? `${side} ` : ''}${String(price)}`.trim();
  }
  if (condition.threshold != null) {
    return tf
      ? tf('conditionThreshold', { value: String(condition.threshold) })
      : `threshold ${String(condition.threshold)}`;
  }
  return '—';
}

export type AlertFormFields = {
  alertType: ForexServerAlertType;
  symbol: string | null;
  side: 'above' | 'below';
  price: string;
  threshold: string;
};

export function alertFormFromRow(row: ForexServerAlertRow): AlertFormFields {
  const c = row.condition ?? {};
  const side = c.side === 'below' ? 'below' : 'above';
  const priceRaw = c.price ?? c.level;
  const threshRaw = c.threshold;
  return {
    alertType: row.alertType as ForexServerAlertType,
    symbol: row.symbol,
    side,
    price: priceRaw != null && String(priceRaw) !== '' ? String(priceRaw) : '',
    threshold: threshRaw != null && String(threshRaw) !== '' ? String(threshRaw) : '',
  };
}

function parseFiniteNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type AlertFormValidationKey =
  | 'validationSymbolRequired'
  | 'validationPriceInvalid'
  | 'validationPricePositive'
  | 'validationThresholdInvalid'
  | 'validationSpreadNegative';

/** UX validation only — backend remains authoritative on reject. */
export function validateAlertFormInput(
  fields: AlertFormFields
): { ok: true } | { ok: false; messageKey: AlertFormValidationKey } {
  const t = fields.alertType;
  if (alertTypeNeedsSymbol(t)) {
    if (!fields.symbol?.trim()) return { ok: false, messageKey: 'validationSymbolRequired' };
  }
  if (alertTypeNeedsPrice(t)) {
    const n = parseFiniteNumber(fields.price);
    if (n == null) return { ok: false, messageKey: 'validationPriceInvalid' };
    if (n <= 0) return { ok: false, messageKey: 'validationPricePositive' };
  }
  if (alertTypeNeedsThreshold(t)) {
    const n = parseFiniteNumber(fields.threshold);
    if (n == null) return { ok: false, messageKey: 'validationThresholdInvalid' };
    if (t === 'SPREAD' && n < 0) return { ok: false, messageKey: 'validationSpreadNegative' };
  }
  return { ok: true };
}

export function buildAlertCondition(fields: Pick<AlertFormFields, 'alertType' | 'side' | 'price' | 'threshold'>): Record<string, unknown> {
  const condition: Record<string, unknown> = {};
  const t = fields.alertType;
  if (t === 'BID' || t === 'ASK' || t === 'PRICE') {
    condition.side = fields.side;
    const n = parseFiniteNumber(fields.price);
    if (n != null) condition.price = String(n);
  } else if (t === 'SPREAD' || t === 'MARGIN' || t === 'DRAWDOWN') {
    condition.side = fields.side;
    const n = parseFiniteNumber(fields.threshold);
    if (n != null) condition.threshold = n;
  }
  return condition;
}

export function buildAlertCreateBody(args: {
  alertType: ForexServerAlertType;
  symbol: string | null;
  side?: 'above' | 'below';
  price?: string;
  threshold?: string;
  cooldownSeconds?: number;
}): Record<string, unknown> {
  const fields: AlertFormFields = {
    alertType: args.alertType,
    symbol: args.symbol,
    side: args.side ?? 'above',
    price: args.price ?? '',
    threshold: args.threshold ?? '',
  };
  return {
    alertType: fields.alertType,
    symbol: fields.symbol?.trim() ? fields.symbol.trim().toUpperCase() : null,
    condition: buildAlertCondition(fields),
    cooldownSeconds: args.cooldownSeconds ?? 60,
  };
}

export function buildAlertPatchBody(fields: AlertFormFields): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    condition: buildAlertCondition(fields),
  };
  if (alertTypeNeedsSymbol(fields.alertType)) {
    patch.symbol = fields.symbol?.trim() ? fields.symbol.trim().toUpperCase() : null;
  } else {
    patch.symbol = null;
  }
  return patch;
}

export function alertTypeNeedsSymbol(type: ForexServerAlertType): boolean {
  return !['SESSION_OPEN', 'SESSION_CLOSE', 'MARGIN', 'DRAWDOWN', 'LIQUIDATION', 'ORDER_FILLED'].includes(type);
}

export function alertTypeNeedsPrice(type: ForexServerAlertType): boolean {
  return type === 'BID' || type === 'ASK' || type === 'PRICE';
}

export function alertTypeNeedsThreshold(type: ForexServerAlertType): boolean {
  return type === 'SPREAD' || type === 'MARGIN' || type === 'DRAWDOWN';
}

/** Maps backend adapter flags to honest UI labels (never SENT/DELIVERED unless event API says so). */
export function labelDeliveryAdapterStatus(
  adapter: {
    configured?: boolean;
    available?: boolean;
  },
  tf?: ForexAlertTranslate
): string {
  if (adapter.available) return tf ? tf('deliveryAvailable') : 'AVAILABLE';
  return tf ? tf('deliveryNotConfigured') : 'NOT_CONFIGURED';
}
