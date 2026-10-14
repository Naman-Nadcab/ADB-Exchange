import { sameWalletAccount } from './caip';
import { buildReturnUrl, buildWalletHandoffUrl, parseWalletReturn } from './deeplink';
import { WalletAccountChangedError, WalletConnectorError } from './errors';
import { getWalletProvider } from './providers';
import type { WalletAccountSnapshot, WalletChangeKind, WalletConnectionState, WalletProviderId } from './types';

export type WalletTransport = {
  canOpen(url: string): Promise<boolean>;
  open(url: string): Promise<void>;
  subscribe(listener: (url: string) => void): () => void;
  createRequestId(): string;
};

export type WalletConnectorOptions = {
  timeoutMs?: number;
  /** Public WalletConnect project id. Empty means the relay client is not active. */
  projectId?: string | null;
  /** Supplies a pairing URI only when a relay client exists. This build does not embed one. */
  createPairingUri?: (() => Promise<string>) | null;
};

type PendingReturn = {
  requestId: string;
  action: 'connect' | 'sign';
  expectedMessage?: string;
  resolve: (value: WalletAccountSnapshot & { signature?: string }) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * External-wallet handoff. Connection state stays in memory.
 * It is not written to the application auth token store.
 */
export class DeeplinkWalletConnector {
  private account: WalletAccountSnapshot | null = null;
  private providerId: WalletProviderId | null = null;
  private pending: PendingReturn | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly listeners = new Set<(kind: WalletChangeKind) => void>();
  private readonly seenRequestIds = new Set<string>();
  private readonly timeoutMs: number;

  constructor(
    private readonly transport: WalletTransport,
    private readonly options: WalletConnectorOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.transport.subscribe((url) => {
      this.onReturnUrl(url);
    });
  }

  stop(): void {
    this.rejectPending(new WalletConnectorError('DEEPLINK_CANCELLED'));
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  getConnection(): WalletConnectionState | null {
    if (!this.account || !this.providerId) return null;
    return { providerId: this.providerId, account: this.account };
  }

  getAccount(): WalletAccountSnapshot | null {
    return this.account;
  }

  watch(listener: (kind: WalletChangeKind) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Background and resume do not cancel an in-flight wallet handoff. */
  handleAppState(_next: 'active' | 'background' | 'inactive'): void {
    return;
  }

  /** Process death drops the in-memory handoff. It does not create a session. */
  abandonAfterProcessDeath(): void {
    this.rejectPending(new WalletConnectorError('DEEPLINK_CANCELLED'));
    this.account = null;
    this.providerId = null;
  }

  cancelPending(): void {
    this.rejectPending(new WalletConnectorError('DEEPLINK_CANCELLED'));
  }

  /**
   * Clears the wallet connection only.
   * Callers must not treat this as application logout.
   */
  disconnect(): void {
    this.rejectPending(new WalletConnectorError('DEEPLINK_CANCELLED'));
    if (!this.account) return;
    this.account = null;
    this.providerId = null;
    this.emit('disconnect');
  }

  async connect(
    providerId: WalletProviderId,
    report: (phase: 'CONNECTING' | 'WAITING_FOR_WALLET') => void,
  ): Promise<WalletAccountSnapshot> {
    report('CONNECTING');
    const provider = getWalletProvider(providerId);
    const installed = await this.transport.canOpen(provider.scheme);
    if (!installed) throw new WalletConnectorError('WALLET_NOT_INSTALLED');
    report('WAITING_FOR_WALLET');
    const requestId = this.transport.createRequestId();
    const returnUrl = buildReturnUrl(requestId);
    const pairingUri = await this.pairingUriFor(provider.namespace);
    const url = buildWalletHandoffUrl({
      provider,
      action: 'connect',
      returnUrl,
      pairingUri,
    });
    const account = await this.openAndWait(url, {
      requestId,
      action: 'connect',
    });
    if (account.namespace !== provider.namespace) {
      throw new WalletConnectorError('DEEPLINK_CANCELLED');
    }
    this.rememberAccount(providerId, account);
    return account;
  }

  async signMessage(
    message: string,
    report: (phase: 'SIGNING' | 'WAITING_FOR_WALLET' | 'RETURNING') => void,
  ): Promise<string> {
    if (!this.account || !this.providerId) throw new WalletConnectorError('DEEPLINK_CANCELLED');
    report('SIGNING');
    const provider = getWalletProvider(this.providerId);
    const before = this.account;
    report('WAITING_FOR_WALLET');
    const requestId = this.transport.createRequestId();
    const pairingUri = await this.pairingUriFor(provider.namespace);
    const url = buildWalletHandoffUrl({
      provider,
      action: 'sign',
      returnUrl: buildReturnUrl(requestId),
      message,
      pairingUri,
    });
    const signed = await this.openAndWait(url, {
      requestId,
      action: 'sign',
      expectedMessage: message,
    });
    report('RETURNING');
    if (signed.namespace !== before.namespace) {
      this.rememberAccount(this.providerId, signed);
      throw new WalletAccountChangedError('account');
    }
    if (signed.chainReference !== before.chainReference) {
      this.rememberAccount(this.providerId, signed);
      throw new WalletAccountChangedError('chain');
    }
    if (!sameWalletAccount(before, signed)) {
      this.rememberAccount(this.providerId, signed);
      throw new WalletAccountChangedError('account');
    }
    if (!signed.signature) throw new WalletConnectorError('VERIFY_FAILED');
    return signed.signature;
  }

  private async pairingUriFor(namespace: 'eip155' | 'solana'): Promise<string | null> {
    if (namespace !== 'eip155') return null;
    if (!this.options.projectId || !this.options.createPairingUri) return null;
    return this.options.createPairingUri();
  }

  private rememberAccount(providerId: WalletProviderId, next: WalletAccountSnapshot): void {
    const previous = this.account;
    this.providerId = providerId;
    this.account = { namespace: next.namespace, chainReference: next.chainReference, address: next.address };
    if (!previous) return;
    if (previous.chainReference !== next.chainReference || previous.namespace !== next.namespace) {
      this.emit('chain');
      return;
    }
    if (!sameWalletAccount(previous, next)) this.emit('account');
  }

  private emit(kind: WalletChangeKind): void {
    this.listeners.forEach((listener) => listener(kind));
  }

  private openAndWait(
    url: string,
    pending: Omit<PendingReturn, 'resolve' | 'reject' | 'timer'>,
  ): Promise<WalletAccountSnapshot & { signature?: string }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.requestId === pending.requestId) this.pending = null;
        reject(new WalletConnectorError('CONNECTION_TIMEOUT'));
      }, this.timeoutMs);
      this.pending = { ...pending, resolve, reject, timer };
      this.transport.open(url).catch(() => {
        this.rejectPending(new WalletConnectorError('WALLET_NOT_INSTALLED'));
      });
    });
  }

  private rejectPending(error: Error): void {
    const pending = this.pending;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending = null;
    pending.reject(error);
  }

  private onReturnUrl(url: string): void {
    const payload = parseWalletReturn(url);
    if (payload.kind === 'unrelated') return;
    if (payload.kind === 'invalid') {
      if (this.pending) this.rejectPending(new WalletConnectorError('DEEPLINK_CANCELLED'));
      return;
    }
    if (this.seenRequestIds.has(payload.requestId)) return;
    const pending = this.pending;
    if (!pending || pending.requestId !== payload.requestId) return;
    this.seenRequestIds.add(payload.requestId);
    clearTimeout(pending.timer);
    this.pending = null;
    if (payload.kind === 'rejected') {
      pending.reject(new WalletConnectorError('USER_REJECTED'));
      return;
    }
    if (payload.kind === 'cancelled') {
      pending.reject(new WalletConnectorError('DEEPLINK_CANCELLED'));
      return;
    }
    if (pending.action === 'connect' && payload.kind !== 'connected') {
      pending.reject(new WalletConnectorError('DEEPLINK_CANCELLED'));
      return;
    }
    if (pending.action === 'sign' && payload.kind !== 'signed') {
      pending.reject(new WalletConnectorError('DEEPLINK_CANCELLED'));
      return;
    }
    if (payload.kind === 'signed') {
      const echoed = new URL(url).searchParams.get('message');
      if (pending.expectedMessage && echoed && echoed !== pending.expectedMessage) {
        pending.reject(new WalletConnectorError('VERIFY_FAILED'));
        return;
      }
      pending.resolve({ ...payload.account, signature: payload.signature });
      return;
    }
    pending.resolve(payload.account);
  }
}
