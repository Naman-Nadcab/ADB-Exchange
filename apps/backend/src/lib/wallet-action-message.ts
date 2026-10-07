/**
 * Action-bound messages for linking a wallet and for sensitive wallet actions.
 * These texts are not STEP 3 sign-in messages. parseWalletAuthMessage rejects them.
 * The stored challenge text is authoritative.
 */

import { AUTH_ONLY_STATEMENT } from '../services/wallet-auth-challenge.service.js';
import { parseWalletAuthMessage } from './wallet-auth-message.js';
import type { WalletNamespace } from './caip10.js';

export const LINK_WALLET_ACTION = 'link_wallet';
export const SET_PRIMARY_ACTION = 'set_primary_wallet';
export const UNLINK_WALLET_ACTION = 'unlink_wallet';
export const AUTHORIZE_RECOVERY_ACTION = 'authorize_wallet_recovery';
export const MARK_COMPROMISED_ACTION = 'mark_wallet_compromised';
export const REPLACE_WALLET_ACTION = 'replace_wallet';

export const WALLET_ACTION_DOMAIN_NAME = 'ADB Exchange';
export const WALLET_ACTION_DOMAIN_VERSION = '1';
export const WALLET_ACTION_VERIFYING_CONTRACT = '0x0000000000000000000000000000000000000000';
export const WALLET_ACTION_PRIMARY_TYPE = 'WalletAction';

export const LINK_STATEMENT =
  'Link this wallet to your existing account. This signature does not send funds or create a transaction.';
export const SET_PRIMARY_STATEMENT =
  'Confirm setting this wallet as your primary sign-in wallet. This does not send funds or create a transaction.';
export const UNLINK_STATEMENT =
  'Confirm removing this wallet from your sign-in methods. This does not send funds or remove assets.';
export const AUTHORIZE_RECOVERY_STATEMENT =
  'Confirm a wallet recovery for your existing account. This does not send funds or create a transaction.';
export const MARK_COMPROMISED_STATEMENT =
  'Confirm marking a sign-in wallet unavailable. This does not send funds or move assets.';
export const REPLACE_WALLET_STATEMENT =
  'Confirm adding this wallet as a replacement sign-in method. This does not send funds, move assets, or create a deposit address.';

const RFC3339_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const NONCE_PATTERN = /^[A-Za-z0-9]{8,128}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;
const EVM_CHAIN = /^(0|[1-9][0-9]{0,15})$/;

export type WalletManagementAction =
  | typeof SET_PRIMARY_ACTION
  | typeof UNLINK_WALLET_ACTION
  | typeof AUTHORIZE_RECOVERY_ACTION
  | typeof MARK_COMPROMISED_ACTION
  | typeof REPLACE_WALLET_ACTION;

const ACTION_STATEMENTS: Record<WalletManagementAction, string> = {
  [SET_PRIMARY_ACTION]: SET_PRIMARY_STATEMENT,
  [UNLINK_WALLET_ACTION]: UNLINK_STATEMENT,
  [AUTHORIZE_RECOVERY_ACTION]: AUTHORIZE_RECOVERY_STATEMENT,
  [MARK_COMPROMISED_ACTION]: MARK_COMPROMISED_STATEMENT,
  [REPLACE_WALLET_ACTION]: REPLACE_WALLET_STATEMENT,
};

export function statementForAction(action: WalletManagementAction): string {
  return ACTION_STATEMENTS[action];
}

export function isWalletManagementAction(value: string): value is WalletManagementAction {
  return Object.prototype.hasOwnProperty.call(ACTION_STATEMENTS, value);
}

export function normalizeWalletProvider(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!PROVIDER_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function evmChainId(chainReference: string): number | null {
  if (!EVM_CHAIN.test(chainReference)) return null;
  let value = 0;
  for (let index = 0; index < chainReference.length; index += 1) {
    value = value * 10 + (chainReference.charCodeAt(index) - 48);
    if (!Number.isSafeInteger(value)) return null;
  }
  return value;
}

function field(line: string, label: string): string | null {
  const prefix = `${label}: `;
  if (!line.startsWith(prefix)) return null;
  const value = line.slice(prefix.length);
  if (!value || value !== value.trim()) return null;
  return value;
}

function chainField(namespace: WalletNamespace, chainReference: string): string {
  return namespace === 'eip155' ? chainReference : `solana:${chainReference}`;
}

export function buildLinkMessage(fields: {
  namespace: WalletNamespace;
  domain: string;
  address: string;
  uri: string;
  chainReference: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  userId: string;
  provider?: string | null;
}): string {
  const lines = [
    `${fields.domain} wants you to link a wallet to your existing account:`,
    fields.address,
    '',
    LINK_STATEMENT,
    '',
    `URI: ${fields.uri}`,
    'Version: 1',
    `Chain ID: ${chainField(fields.namespace, fields.chainReference)}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    `Expiration Time: ${fields.expirationTime}`,
    `Account: ${fields.userId}`,
    `Action: ${LINK_WALLET_ACTION}`,
  ];
  if (fields.provider) lines.push(`Provider: ${fields.provider}`);
  return lines.join('\n');
}

export type ParsedLinkMessage = {
  namespace: WalletNamespace;
  domain: string;
  address: string;
  uri: string;
  chainReference: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  userId: string;
  provider: string | null;
};

export function parseLinkMessage(message: string): ParsedLinkMessage | null {
  if (typeof message !== 'string' || message.length === 0 || message.length > 8192) return null;
  if (message.includes('\r')) return null;
  if (parseWalletAuthMessage(message)) return null;
  if (message.includes(AUTH_ONLY_STATEMENT)) return null;
  const lines = message.split('\n');
  if (lines.length !== 13 && lines.length !== 14) return null;
  const header = lines[0] ?? '';
  const suffix = ' wants you to link a wallet to your existing account:';
  if (!header.endsWith(suffix)) return null;
  const domain = header.slice(0, -suffix.length);
  if (!domain || domain !== domain.trim() || domain.includes(' ')) return null;
  const address = lines[1] ?? '';
  if (!address || address !== address.trim()) return null;
  if (lines[2] !== '' || lines[4] !== '') return null;
  if (lines[3] !== LINK_STATEMENT) return null;
  const uri = field(lines[5] ?? '', 'URI');
  const version = field(lines[6] ?? '', 'Version');
  const chain = field(lines[7] ?? '', 'Chain ID');
  const nonce = field(lines[8] ?? '', 'Nonce');
  const issuedAt = field(lines[9] ?? '', 'Issued At');
  const expirationTime = field(lines[10] ?? '', 'Expiration Time');
  const userId = field(lines[11] ?? '', 'Account');
  const action = field(lines[12] ?? '', 'Action');
  if (!uri || version !== '1' || !chain || !nonce || !issuedAt || !expirationTime || !userId || !action) return null;
  if (action !== LINK_WALLET_ACTION) return null;
  if (!RFC3339_SECONDS.test(issuedAt) || !RFC3339_SECONDS.test(expirationTime)) return null;
  if (!NONCE_PATTERN.test(nonce) || !UUID_PATTERN.test(userId)) return null;

  let namespace: WalletNamespace;
  let chainReference = '';
  if (/^(0|[1-9][0-9]{0,19})$/.test(chain)) {
    namespace = 'eip155';
    chainReference = chain;
  } else if (chain.startsWith('solana:')) {
    namespace = 'solana';
    chainReference = chain.slice('solana:'.length);
    if (!chainReference || chainReference.includes(':')) return null;
  } else {
    return null;
  }

  let provider: string | null = null;
  if (lines.length === 14) {
    provider = field(lines[13] ?? '', 'Provider');
    if (!provider || provider !== normalizeWalletProvider(provider)) return null;
  }

  return {
    namespace,
    domain,
    address,
    uri,
    chainReference,
    nonce,
    issuedAt,
    expirationTime,
    userId,
    provider,
  };
}

export type EvmActionTypedData = {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    WalletAction: Array<{ name: string; type: string }>;
  };
  primaryType: typeof WALLET_ACTION_PRIMARY_TYPE;
  message: {
    action: WalletManagementAction;
    statement: string;
    userId: string;
    targetWalletId: string;
    targetAddress: string;
    namespace: 'eip155';
    chainReference: string;
    nonce: string;
    issuedAt: string;
    expiry: string;
    origin: string;
  };
};

const ACTION_TYPE_FIELDS = [
  { name: 'action', type: 'string' },
  { name: 'statement', type: 'string' },
  { name: 'userId', type: 'string' },
  { name: 'targetWalletId', type: 'string' },
  { name: 'targetAddress', type: 'string' },
  { name: 'namespace', type: 'string' },
  { name: 'chainReference', type: 'string' },
  { name: 'nonce', type: 'string' },
  { name: 'issuedAt', type: 'string' },
  { name: 'expiry', type: 'string' },
  { name: 'origin', type: 'string' },
];

export function buildEvmActionTypedData(fields: {
  action: WalletManagementAction;
  userId: string;
  targetWalletId: string;
  targetAddress: string;
  chainReference: string;
  nonce: string;
  issuedAt: string;
  expiry: string;
  origin: string;
}): { json: string; typed: EvmActionTypedData } | null {
  const chainId = evmChainId(fields.chainReference);
  if (chainId == null) return null;
  const typed: EvmActionTypedData = {
    domain: {
      name: WALLET_ACTION_DOMAIN_NAME,
      version: WALLET_ACTION_DOMAIN_VERSION,
      chainId,
      verifyingContract: WALLET_ACTION_VERIFYING_CONTRACT,
    },
    types: { WalletAction: ACTION_TYPE_FIELDS },
    primaryType: WALLET_ACTION_PRIMARY_TYPE,
    message: {
      action: fields.action,
      statement: statementForAction(fields.action),
      userId: fields.userId,
      targetWalletId: fields.targetWalletId,
      targetAddress: fields.targetAddress,
      namespace: 'eip155',
      chainReference: fields.chainReference,
      nonce: fields.nonce,
      issuedAt: fields.issuedAt,
      expiry: fields.expiry,
      origin: fields.origin,
    },
  };
  return { json: JSON.stringify(typed), typed };
}

export function parseEvmActionTypedData(message: string): EvmActionTypedData | null {
  if (typeof message !== 'string' || !message.startsWith('{') || message.length > 8192) return null;
  if (parseWalletAuthMessage(message)) return null;
  let value: unknown;
  try {
    value = JSON.parse(message);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const typed = value as EvmActionTypedData;
  if (typed.primaryType !== WALLET_ACTION_PRIMARY_TYPE) return null;
  if (!typed.domain || typed.domain.name !== WALLET_ACTION_DOMAIN_NAME) return null;
  if (typed.domain.version !== WALLET_ACTION_DOMAIN_VERSION) return null;
  if (typed.domain.verifyingContract !== WALLET_ACTION_VERIFYING_CONTRACT) return null;
  if (!Number.isSafeInteger(typed.domain.chainId)) return null;
  const fields = typed.types?.WalletAction;
  if (!Array.isArray(fields) || fields.length !== ACTION_TYPE_FIELDS.length) return null;
  for (let i = 0; i < ACTION_TYPE_FIELDS.length; i += 1) {
    if (fields[i]?.name !== ACTION_TYPE_FIELDS[i]?.name || fields[i]?.type !== 'string') return null;
  }
  const body = typed.message;
  if (!body || typeof body !== 'object') return null;
  if (!isWalletManagementAction(body.action)) return null;
  if (body.statement !== statementForAction(body.action)) return null;
  if (body.namespace !== 'eip155') return null;
  if (!UUID_PATTERN.test(body.userId) || !UUID_PATTERN.test(body.targetWalletId)) return null;
  if (!NONCE_PATTERN.test(body.nonce)) return null;
  if (!RFC3339_SECONDS.test(body.issuedAt) || !RFC3339_SECONDS.test(body.expiry)) return null;
  if (String(typed.domain.chainId) !== body.chainReference) return null;
  if (!body.targetAddress || !body.origin || !body.chainReference) return null;
  const again = buildEvmActionTypedData({
    action: body.action,
    userId: body.userId,
    targetWalletId: body.targetWalletId,
    targetAddress: body.targetAddress,
    chainReference: body.chainReference,
    nonce: body.nonce,
    issuedAt: body.issuedAt,
    expiry: body.expiry,
    origin: body.origin,
  });
  if (!again || again.json !== message) return null;
  return again.typed;
}

export function buildSolanaActionMessage(fields: {
  domain: string;
  address: string;
  uri: string;
  chainReference: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  userId: string;
  action: WalletManagementAction;
  walletId: string;
}): string {
  return [
    `${fields.domain} wants you to authorize a wallet management action:`,
    fields.address,
    '',
    statementForAction(fields.action),
    '',
    `URI: ${fields.uri}`,
    'Version: 1',
    `Chain ID: solana:${fields.chainReference}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    `Expiration Time: ${fields.expirationTime}`,
    `Account: ${fields.userId}`,
    `Action: ${fields.action}`,
    `Wallet: ${fields.walletId}`,
  ].join('\n');
}

export type ParsedSolanaActionMessage = {
  domain: string;
  address: string;
  uri: string;
  chainReference: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  userId: string;
  action: WalletManagementAction;
  walletId: string;
};

export function parseSolanaActionMessage(message: string): ParsedSolanaActionMessage | null {
  if (typeof message !== 'string' || message.length === 0 || message.length > 8192) return null;
  if (message.includes('\r')) return null;
  if (parseWalletAuthMessage(message)) return null;
  const lines = message.split('\n');
  if (lines.length !== 14) return null;
  const header = lines[0] ?? '';
  const suffix = ' wants you to authorize a wallet management action:';
  if (!header.endsWith(suffix)) return null;
  const domain = header.slice(0, -suffix.length);
  if (!domain || domain !== domain.trim() || domain.includes(' ')) return null;
  const address = lines[1] ?? '';
  if (!address || address !== address.trim()) return null;
  if (lines[2] !== '' || lines[4] !== '') return null;
  const uri = field(lines[5] ?? '', 'URI');
  const version = field(lines[6] ?? '', 'Version');
  const chain = field(lines[7] ?? '', 'Chain ID');
  const nonce = field(lines[8] ?? '', 'Nonce');
  const issuedAt = field(lines[9] ?? '', 'Issued At');
  const expirationTime = field(lines[10] ?? '', 'Expiration Time');
  const userId = field(lines[11] ?? '', 'Account');
  const action = field(lines[12] ?? '', 'Action');
  const walletId = field(lines[13] ?? '', 'Wallet');
  if (!uri || version !== '1' || !chain || !nonce || !issuedAt || !expirationTime || !userId || !action || !walletId) {
    return null;
  }
  if (!isWalletManagementAction(action)) return null;
  if (lines[3] !== statementForAction(action)) return null;
  if (!chain.startsWith('solana:')) return null;
  const chainReference = chain.slice('solana:'.length);
  if (!chainReference || chainReference.includes(':')) return null;
  if (!RFC3339_SECONDS.test(issuedAt) || !RFC3339_SECONDS.test(expirationTime)) return null;
  if (!NONCE_PATTERN.test(nonce) || !UUID_PATTERN.test(userId) || !UUID_PATTERN.test(walletId)) return null;
  return {
    domain,
    address,
    uri,
    chainReference,
    nonce,
    issuedAt,
    expirationTime,
    userId,
    action,
    walletId,
  };
}
