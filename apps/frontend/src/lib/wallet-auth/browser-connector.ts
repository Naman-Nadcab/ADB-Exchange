import { BRAND_NAME } from '@/lib/brand';
import { encodeBase58, hexChainToReference, utf8MessageToHex } from './encoding';
import type { WalletAccountSnapshot, WalletChangeKind } from './flow';

export type DiscoveredWallet = {
  id: string;
  name: string;
  namespace: 'eip155' | 'solana';
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isPhantom?: boolean;
  providers?: Eip1193Provider[];
};

type Eip6963Detail = {
  info: { uuid: string; name: string; rdns: string };
  provider: Eip1193Provider;
};

type SolanaAccount = {
  address: string;
  chains: readonly string[];
};

type StandardWallet = {
  name: string;
  features: Record<string, unknown>;
  accounts: readonly SolanaAccount[];
};

type SolanaInjected = {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  signMessage: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array }>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  publicKey?: { toString(): string } | null;
};

type ActiveSession = {
  namespace: 'eip155' | 'solana';
  getAccount: () => Promise<WalletAccountSnapshot>;
  signMessage: (message: string) => Promise<string>;
  signTypedData?: (typedDataJson: string) => Promise<string>;
  watch: (onChange: (kind: WalletChangeKind) => void) => () => void;
  disconnect: () => Promise<void>;
};

const sessions = new Map<string, () => Promise<ActiveSession>>();
const announcedEvm = new Map<string, Eip6963Detail>();
const standardWallets = new Map<string, StandardWallet>();
let listenersReady = false;
let active: ActiveSession | null = null;

function ensureWalletListeners(): void {
  if (listenersReady || typeof window === 'undefined') return;
  listenersReady = true;
  window.addEventListener('eip6963:announceProvider', (event) => {
    const detail = (event as CustomEvent<Eip6963Detail>).detail;
    if (detail?.info?.uuid && detail.provider) announcedEvm.set(detail.info.uuid, detail);
  });
  const register = (wallet: StandardWallet) => {
    if (wallet?.name) standardWallets.set(wallet.name, wallet);
  };
  const api = Object.freeze({ register });
  window.addEventListener('wallet-standard:register-wallet', ((event: Event) => {
    const callback = (event as CustomEvent<(app: { register: (wallet: StandardWallet) => void }) => void>).detail;
    try {
      callback?.(api);
    } catch {
      /* a wallet that fails to register is skipped */
    }
  }) as EventListener);
  try {
    window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api }));
  } catch {
    /* ignore */
  }
}

function walletConnectProjectId(): string {
  const value = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  return typeof value === 'string' ? value.trim() : '';
}

function providerName(provider: Eip1193Provider, announced?: string): string {
  if (announced) return announced;
  if (provider.isCoinbaseWallet) return 'Coinbase Wallet';
  if (provider.isTrust || provider.isTrustWallet) return 'Trust Wallet';
  if (provider.isPhantom) return 'Phantom';
  if (provider.isMetaMask) return 'MetaMask';
  return 'Browser wallet';
}

function remember(id: string, open: () => Promise<ActiveSession>): DiscoveredWallet['id'] {
  sessions.set(id, open);
  return id;
}

export function discoverWallets(): DiscoveredWallet[] {
  if (typeof window === 'undefined') return [];
  ensureWalletListeners();
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  sessions.clear();
  const found: DiscoveredWallet[] = [];
  const seen = new Set<string>();

  announcedEvm.forEach((detail) => {
    const id = remember(`eip6963:${detail.info.uuid}`, () => openEvm(detail.provider));
    found.push({ id, name: providerName(detail.provider, detail.info.name), namespace: 'eip155' });
    seen.add(detail.info.rdns || detail.info.uuid);
  });

  const ethereum = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  const injected = ethereum?.providers?.length ? ethereum.providers : ethereum ? [ethereum] : [];
  injected.forEach((provider, index) => {
    const name = providerName(provider);
    const key = name.toLowerCase();
    if (Array.from(announcedEvm.values()).some((item) => item.info.name === name)) return;
    if (seen.has(key)) return;
    seen.add(key);
    const id = remember(`injected:${index}:${key}`, () => openEvm(provider));
    found.push({ id, name, namespace: 'eip155' });
  });

  const projectId = walletConnectProjectId();
  if (projectId) {
    const id = remember('walletconnect', () => openWalletConnect(projectId));
    found.push({ id, name: 'WalletConnect', namespace: 'eip155' });
  }

  const solanaNames = new Set<string>();
  standardWallets.forEach((wallet) => {
    if (!wallet.features['solana:signMessage'] || !wallet.features['standard:connect']) return;
    const id = remember(`solana-standard:${wallet.name}`, () => openStandardSolana(wallet));
    found.push({ id, name: wallet.name, namespace: 'solana' });
    solanaNames.add(wallet.name.toLowerCase());
  });

  const phantom = readPhantom();
  if (phantom && !solanaNames.has('phantom')) {
    const id = remember('solana-injected:phantom', () => openInjectedSolana(phantom));
    found.push({ id, name: 'Phantom', namespace: 'solana' });
  }

  return found;
}

export async function connectWallet(id: string): Promise<WalletAccountSnapshot> {
  const open = sessions.get(id);
  if (!open) throw new Error('WALLET_MISSING');
  active = await open();
  return active.getAccount();
}

export async function currentWalletAccount(): Promise<WalletAccountSnapshot> {
  if (!active) throw new Error('WALLET_DISCONNECTED');
  return active.getAccount();
}

export async function signWalletMessage(message: string): Promise<string> {
  if (!active) throw new Error('WALLET_DISCONNECTED');
  return active.signMessage(message);
}

/** EVM step-up uses eth_signTypedData_v4. Solana step-up stays on signMessage. */
export async function signWalletTypedData(typedDataJson: string): Promise<string> {
  if (!active?.signTypedData) throw new Error('TYPED_DATA_UNSUPPORTED');
  return active.signTypedData(typedDataJson);
}

export function watchWallet(onChange: (kind: WalletChangeKind) => void): () => void {
  if (!active) return () => {};
  return active.watch(onChange);
}

export async function disconnectWallet(): Promise<void> {
  const current = active;
  active = null;
  if (current) await current.disconnect();
}

async function openEvm(provider: Eip1193Provider): Promise<ActiveSession> {
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  const address = Array.isArray(accounts) ? String(accounts[0] ?? '') : '';
  if (!address) throw new Error('NO_ACCOUNT');
  return {
    namespace: 'eip155',
    getAccount: () => readEvmAccount(provider),
    signMessage: (message) => signEvm(provider, message),
    signTypedData: (typedDataJson) => signEvmTypedData(provider, typedDataJson),
    watch: (onChange) => watchEvm(provider, onChange),
    disconnect: async () => {},
  };
}

async function readEvmAccount(provider: Eip1193Provider): Promise<WalletAccountSnapshot> {
  const accounts = await provider.request({ method: 'eth_accounts' });
  const chainId = await provider.request({ method: 'eth_chainId' });
  const address = Array.isArray(accounts) ? String(accounts[0] ?? '') : '';
  if (!address || typeof chainId !== 'string') throw new Error('WALLET_DISCONNECTED');
  return { namespace: 'eip155', address, chainReference: hexChainToReference(chainId) };
}

async function signEvm(provider: Eip1193Provider, message: string): Promise<string> {
  const account = await readEvmAccount(provider);
  const signature = await provider.request({
    method: 'personal_sign',
    params: [utf8MessageToHex(message), account.address],
  });
  if (typeof signature !== 'string' || !signature.startsWith('0x')) throw new Error('BAD_SIGNATURE');
  return signature;
}

async function signEvmTypedData(provider: Eip1193Provider, typedDataJson: string): Promise<string> {
  const account = await readEvmAccount(provider);
  const signature = await provider.request({
    method: 'eth_signTypedData_v4',
    params: [account.address, typedDataJson],
  });
  if (typeof signature !== 'string' || !signature.startsWith('0x')) throw new Error('BAD_SIGNATURE');
  return signature;
}

function watchEvm(provider: Eip1193Provider, onChange: (kind: WalletChangeKind) => void): () => void {
  const onAccounts = (accounts: unknown) => {
    if (!Array.isArray(accounts) || accounts.length === 0) onChange('disconnect');
    else onChange('account');
  };
  const onChain = () => onChange('chain');
  const onDisconnect = () => onChange('disconnect');
  provider.on?.('accountsChanged', onAccounts);
  provider.on?.('chainChanged', onChain);
  provider.on?.('disconnect', onDisconnect);
  return () => {
    provider.removeListener?.('accountsChanged', onAccounts);
    provider.removeListener?.('chainChanged', onChain);
    provider.removeListener?.('disconnect', onDisconnect);
  };
}

async function openWalletConnect(projectId: string): Promise<ActiveSession> {
  const imported = await import('@walletconnect/ethereum-provider');
  const EthereumProvider = imported.default;
  const provider = await EthereumProvider.init({
    projectId,
    showQrModal: true,
    optionalChains: [1],
    methods: ['personal_sign', 'eth_signTypedData_v4', 'eth_chainId', 'eth_accounts', 'eth_requestAccounts'],
    events: ['accountsChanged', 'chainChanged'],
    qrModalOptions: { themeMode: 'dark' },
    metadata: {
      name: BRAND_NAME,
      description: 'Sign in with your wallet. This does not send funds.',
      url: window.location.origin,
      icons: [],
    },
  });
  await provider.enable();
  const eip = provider as unknown as Eip1193Provider;
  return {
    namespace: 'eip155',
    getAccount: () => readEvmAccount(eip),
    signMessage: (message) => signEvm(eip, message),
    signTypedData: (typedDataJson) => signEvmTypedData(eip, typedDataJson),
    watch: (onChange) => watchEvm(eip, onChange),
    disconnect: async () => {
      await provider.disconnect();
    },
  };
}

async function openStandardSolana(wallet: StandardWallet): Promise<ActiveSession> {
  const connectFeature = wallet.features['standard:connect'] as {
    connect: () => Promise<{ accounts: readonly SolanaAccount[] }>;
  };
  const signFeature = wallet.features['solana:signMessage'] as {
    signMessage: (inputs: { account: SolanaAccount; message: Uint8Array }[]) => Promise<{ signature: Uint8Array }[]>;
  };
  const connected = await connectFeature.connect();
  const account = connected.accounts[0] ?? wallet.accounts[0];
  if (!account) throw new Error('NO_ACCOUNT');
  return {
    namespace: 'solana',
    getAccount: async () => solanaSnapshot(wallet.accounts[0] ?? account),
    signMessage: async (message) => {
      const current = wallet.accounts[0] ?? account;
      const signed = await signFeature.signMessage([{ account: current, message: new TextEncoder().encode(message) }]);
      const signature = signed[0]?.signature;
      if (!signature) throw new Error('BAD_SIGNATURE');
      return encodeBase58(signature);
    },
    watch: (onChange) => {
      const events = wallet.features['standard:events'] as {
        on: (event: string, listener: (args: { accounts?: readonly SolanaAccount[] }) => void) => () => void;
      } | undefined;
      if (!events?.on) return () => {};
      return events.on('change', (args) => {
        if (!args.accounts || args.accounts.length === 0) onChange('disconnect');
        else onChange('account');
      });
    },
    disconnect: async () => {
      const feature = wallet.features['standard:disconnect'] as { disconnect: () => Promise<void> } | undefined;
      await feature?.disconnect();
    },
  };
}

function solanaSnapshot(account: SolanaAccount): WalletAccountSnapshot {
  const chain = account.chains.find((item) => item.startsWith('solana:'));
  const chainReference = chain?.slice('solana:'.length) || 'mainnet';
  return { namespace: 'solana', address: account.address, chainReference };
}

function readPhantom(): SolanaInjected | null {
  const browser = window as Window & { phantom?: { solana?: SolanaInjected }; solana?: SolanaInjected };
  const provider = browser.phantom?.solana ?? browser.solana;
  if (!provider?.signMessage || !provider.connect) return null;
  return provider;
}

async function openInjectedSolana(provider: SolanaInjected): Promise<ActiveSession> {
  const connected = await provider.connect();
  const address = connected.publicKey?.toString() || provider.publicKey?.toString() || '';
  if (!address) throw new Error('NO_ACCOUNT');
  return {
    namespace: 'solana',
    getAccount: async () => ({
      namespace: 'solana',
      address: provider.publicKey?.toString() || address,
      chainReference: 'mainnet',
    }),
    signMessage: async (message) => {
      const signed = await provider.signMessage(new TextEncoder().encode(message), 'utf8');
      return encodeBase58(signed.signature);
    },
    watch: (onChange) => {
      const onAccount = () => onChange('account');
      const onDisconnect = () => onChange('disconnect');
      provider.on?.('accountChanged', onAccount);
      provider.on?.('disconnect', onDisconnect);
      return () => {
        provider.removeListener?.('accountChanged', onAccount);
        provider.removeListener?.('disconnect', onDisconnect);
      };
    },
    disconnect: async () => {},
  };
}
