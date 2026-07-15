/** P2P payment methods — field templates and validation (website parity). */

import type { QueryClient } from '@tanstack/react-query';
import type { P2PUserPaymentMethod } from '@exchange/mobile-types';

export type PaymentFieldDef = {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
};

const FIELD_MAP: Record<string, PaymentFieldDef[]> = {
  bank_transfer: [
    { key: 'account_name', label: 'Account Holder Name', placeholder: 'Full name as on bank account', required: true },
    { key: 'bank_name', label: 'Bank Name', placeholder: 'e.g. State Bank of India', required: true },
    { key: 'account_number', label: 'Account Number', placeholder: 'Bank account number', required: true },
    { key: 'ifsc', label: 'IFSC Code', placeholder: 'e.g. SBIN0001234', required: true },
  ],
  bank: [
    { key: 'account_name', label: 'Account Holder Name', placeholder: 'Full name', required: true },
    { key: 'bank_name', label: 'Bank Name', placeholder: 'Bank name', required: true },
    { key: 'account_number', label: 'Account Number', placeholder: 'Account number', required: true },
    { key: 'ifsc', label: 'IFSC / Routing Code', placeholder: 'IFSC or routing code', required: true },
  ],
  upi: [
    { key: 'account_name', label: 'Name', placeholder: 'Name linked to UPI', required: true },
    { key: 'upi_id', label: 'UPI ID', placeholder: 'e.g. yourname@upi', required: true },
  ],
  imps: [
    { key: 'account_name', label: 'Account Holder Name', placeholder: 'Full name', required: true },
    { key: 'bank_name', label: 'Bank Name', placeholder: 'Bank name', required: true },
    { key: 'account_number', label: 'Account Number', placeholder: 'Account number', required: true },
    { key: 'ifsc', label: 'IFSC Code', placeholder: 'IFSC code', required: true },
  ],
  wire: [
    { key: 'account_name', label: 'Beneficiary Name', placeholder: 'Full legal name', required: true },
    { key: 'bank_name', label: 'Bank Name', placeholder: 'Bank or institution', required: true },
    { key: 'account_number', label: 'Account / IBAN', placeholder: 'Account number or IBAN', required: true },
    { key: 'swift', label: 'SWIFT / BIC', placeholder: 'SWIFT code', required: true },
  ],
};

const DEFAULT_FIELDS: PaymentFieldDef[] = [
  { key: 'account_name', label: 'Account Holder Name', placeholder: 'Full name', required: true },
  { key: 'bank_name', label: 'Bank / Institution', placeholder: 'Bank or payment provider' },
  { key: 'account_number', label: 'Account Number / ID', placeholder: 'Account number or identifier', required: true },
  { key: 'ifsc', label: 'IFSC / Routing / SWIFT', placeholder: 'Routing code' },
];

export const P2P_MY_PAYMENT_METHODS_LIST_KEY = ['p2p', 'my-payment-methods'] as const;

export function getFieldsForMethodCode(code: string | undefined): PaymentFieldDef[] {
  if (!code) return DEFAULT_FIELDS;
  const lc = code.toLowerCase();
  for (const [k, v] of Object.entries(FIELD_MAP)) {
    if (lc.includes(k)) return v;
  }
  return DEFAULT_FIELDS;
}

export function formatPaymentDetailLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildPaymentDetailsPayload(
  fields: Record<string, string>,
  defs: PaymentFieldDef[],
): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  for (const def of defs) {
    const v = fields[def.key]?.trim();
    if (v) details[def.key] = v;
  }
  return details;
}

export function validatePaymentMethodForm(
  platformId: string,
  fields: Record<string, string>,
  defs: PaymentFieldDef[],
): string | null {
  if (!platformId.trim()) return 'Select a payment type';
  for (const def of defs) {
    if (def.required && !fields[def.key]?.trim()) {
      return `${def.label} is required`;
    }
  }
  return null;
}

export function isPaymentMethodActive(method: P2PUserPaymentMethod): boolean {
  return method.is_active !== false;
}

export function paymentMethodTitle(method: P2PUserPaymentMethod): string {
  return method.display_name?.trim() || method.method_name;
}

export function paymentMethodSubtitle(method: P2PUserPaymentMethod): string | null {
  if (method.display_name && method.method_name && method.display_name !== method.method_name) {
    return method.method_name;
  }
  return null;
}

export function paymentMethodUpdatedLabel(method: P2PUserPaymentMethod): string | null {
  const raw = method.updated_at ?? method.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function countPaymentMethodsByActive(list: P2PUserPaymentMethod[]): { active: number; disabled: number } {
  let active = 0;
  let disabled = 0;
  for (const row of list) {
    if (isPaymentMethodActive(row)) active += 1;
    else disabled += 1;
  }
  return { active, disabled };
}

export function paymentMethodDetailEntries(method: P2PUserPaymentMethod): Array<[string, string]> {
  const details = method.payment_details;
  if (!details || typeof details !== 'object') return [];
  return Object.entries(details).filter(([, v]) => v != null && String(v).trim() !== '') as Array<[string, string]>;
}

export function verificationBadge(method: P2PUserPaymentMethod): { label: string; tone: 'verified' | 'pending' } | null {
  if (method.is_verified === true) return { label: 'Verified', tone: 'verified' };
  if (method.is_verified === false) return { label: 'Pending verification', tone: 'pending' };
  const legacy = method.verification_status?.toLowerCase();
  if (legacy === 'verified') return { label: 'Verified', tone: 'verified' };
  if (legacy === 'pending') return { label: 'Pending verification', tone: 'pending' };
  if (legacy === 'rejected') return { label: 'Rejected', tone: 'pending' };
  return null;
}

/** ADR-011 — resolve payment method from list cache (no GET-by-ID endpoint). */
export function findPaymentMethodInCache(
  qc: QueryClient,
  methodId: string,
): P2PUserPaymentMethod | undefined {
  const list = qc.getQueryData<P2PUserPaymentMethod[]>(P2P_MY_PAYMENT_METHODS_LIST_KEY);
  return list?.find((m) => m.id === methodId);
}

export function fieldsFromExistingDetails(
  defs: PaymentFieldDef[],
  details?: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of defs) {
    const v = details?.[def.key];
    if (v != null) out[def.key] = String(v);
  }
  return out;
}

export function methodIconName(code: string | undefined): 'business-outline' | 'phone-portrait-outline' | 'cash-outline' | 'card-outline' {
  const lc = (code ?? '').toLowerCase();
  if (lc.includes('upi')) return 'phone-portrait-outline';
  if (lc.includes('imps') || lc.includes('bank')) return 'business-outline';
  if (lc.includes('wire')) return 'business-outline';
  return 'card-outline';
}
