'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { isClientAuthed } from '@/lib/authSession';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { api } from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { QRCodeSVG } from 'qrcode.react';
import { useLocalizedNotify } from '@/hooks/useLocalizedNotify';
import { toast } from '@/components/ui/toaster';
import {
  ChevronDown,
  Copy,
  Check,
  HelpCircle,
  ExternalLink,
  Info,
  Search,
  RefreshCw,
  AlertTriangle,
  X,
  Shield,
  Upload,
  Camera,
} from 'lucide-react';
import { WalletOperationsShell } from '@/components/wallet/WalletOperationsShell';

interface Chain {
  id: string;
  id_text?: string;
  name: string;
  type: string;
  native_currency: string;
  confirmations_required?: number;
  explorer_url?: string;
  icon?: string;
}

interface Token {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  is_native: boolean;
  icon?: string;
}

interface DepositAddress {
  address: string;
  chain: {
    id: string;
    name: string;
    type: string;
    confirmationsRequired: number;
    explorerUrl: string;
  };
  qrCodeData: string;
  notice: string;
}

interface Deposit {
  id: string;
  symbol: string;
  chain_name: string;
  amount: string;
  tx_hash?: string;
  explorer_url?: string;
  to_address: string;
  confirmations: number;
  required_confirmations: number;
  status: string;
  created_at: string;
}

interface KycStatus {
  verified: boolean;
  status: string;
  level: number;
}

// Coins that require memo/tag on deposit
const MEMO_TAG_COINS = new Set(['XRP', 'XLM', 'ATOM', 'EOS', 'HBAR', 'STX', 'TON']);

// Popular tokens for quick selection (BTC, ETH, USDT, USDC, BNB, SOL, TRX)
const POPULAR_TOKENS = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'TRX'];

export default function DepositCryptoPage() {
  const tw = useTranslations('wallet');
  const tt = useTranslations('account.toasts');
  const { error: notifyError } = useLocalizedNotify();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const coinParam = searchParams.get('coin');
  const { accessToken, _hasHydrated, isAuthenticated } = useAuthStore();
  const sessionReady = isClientAuthed(_hasHydrated, isAuthenticated);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [initialCoinSet, setInitialCoinSet] = useState(false);
  const [availableChains, setAvailableChains] = useState<Chain[]>([]);
  const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
  const [depositAddress, setDepositAddress] = useState<DepositAddress | null>(null);
  const [recentDeposits, setRecentDeposits] = useState<Deposit[]>([]);
  const [recentDepositsLoading, setRecentDepositsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addressLoading, setAddressLoading] = useState(false);
  const [chainsLoading, setChainsLoading] = useState(false);
  const [chainsError, setChainsError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [showKycModal, setShowKycModal] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  const API_URL = getApiBaseUrl();

  // Get chain image path
  const getChainIcon = (chain: Chain) => {
    const iconName = chain.icon || chain.name.toLowerCase().replace(/\s+/g, '');
    // Map common chain names to icon files
    const iconMapping: Record<string, string> = {
      'ethereum': 'ethereum',
      'eth': 'ethereum',
      'bnb smart chain': 'bnb',
      'bsc': 'bnb',
      'polygon': 'polygon',
      'matic': 'polygon',
      'arbitrum one': 'arbitrum',
      'arbitrum': 'arbitrum',
      'arb': 'arbitrum',
      'solana': 'solana',
      'sol': 'solana',
      'tron': 'tron',
      'trx': 'tron',
      'bitcoin': 'bitcoin',
      'btc': 'bitcoin',
      'polkadot': 'polkadot',
      'dot': 'polkadot',
      'avalanche c-chain': 'avalanche',
      'avalanche': 'avalanche',
      'avax': 'avalanche',
    };
    const icon = iconMapping[iconName] || iconMapping[chain.id_text?.toLowerCase() || ''] || 'ethereum';
    return `/assets/upload/blockchain-logo/${icon}.svg`;
  };

  // 1) Load assets (tokens) on mount
  useEffect(() => {
    fetchTokens();
    if (sessionReady) {
      fetchKycStatus();
      fetchRecentDeposits();
    }
  }, [sessionReady]);

  // Poll deposit history while on page (pending → completed)
  useEffect(() => {
    if (!sessionReady) return;
    const id = window.setInterval(() => {
      void fetchRecentDeposits();
    }, 12_000);
    return () => window.clearInterval(id);
  }, [sessionReady]);

  // Auto-select coin from URL parameter
  useEffect(() => {
    if (coinParam && tokens.length > 0 && !initialCoinSet) {
      const matchedToken = tokens.find(
        t => t.symbol.toUpperCase() === coinParam.toUpperCase()
      );
      if (matchedToken) {
        setSelectedToken(matchedToken);
        setInitialCoinSet(true);
      }
    }
  }, [coinParam, tokens, initialCoinSet]);

  // 2) When asset (token) is selected: fetch chains that support this asset only
  useEffect(() => {
    if (selectedToken) {
      setSelectedChain(null);
      setDepositAddress(null);
      setAddressError(null);
      fetchChainsForAsset(selectedToken.symbol);
    } else {
      setAvailableChains([]);
      setSelectedChain(null);
      setDepositAddress(null);
    }
  }, [selectedToken?.id]);

  // When chains for asset are loaded, auto-select first chain if none selected
  useEffect(() => {
    if (selectedToken && availableChains.length > 0 && !selectedChain) {
      setSelectedChain(availableChains[0]);
    }
  }, [availableChains.length, selectedToken?.id]);

  // Fetch deposit address when chain is selected
  useEffect(() => {
    if (selectedChain && _hasHydrated && accessToken) {
      fetchDepositAddress(selectedChain.id);
    }
  }, [selectedChain, _hasHydrated, accessToken]);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/wallet/tokens`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setTokens(data.data);
        }
      }
    } catch (error) {
      notifyError(tt('loadTokensFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchKycStatus = async () => {
    if (!accessToken) return;
    try {
      const result = await api.get<{ verified: boolean; status: string; level: number }>('/api/v1/wallet/kyc-status');
      if (result.success && result.data) {
        setKycStatus(result.data);
      }
    } catch (error) {
      notifyError(tt('loadKycFailed'));
    }
  };

  // Fetch chains that support the selected asset (token). Asset must be related to chain.
  const fetchChainsForAsset = async (symbol: string) => {
    try {
      setChainsLoading(true);
      setChainsError(null);
      const result = await api.get<Chain[]>(`/api/v1/wallet/tokens/${encodeURIComponent(symbol)}/chains`);
      if (result.success && Array.isArray(result.data)) {
        setAvailableChains(result.data);
        setChainsError(null);
        if (result.data.length === 0) {
          setChainsError(tw('deposit.errors.noChainsForSymbol', { symbol }));
        }
      } else {
        setAvailableChains([]);
        setChainsError(result.error?.message || tw('deposit.errors.loadChainsFailed'));
      }
    } catch (error) {
      notifyError(tt('loadChainsFailed'));
      setAvailableChains([]);
      setChainsError(tw('deposit.errors.networkError'));
    } finally {
      setChainsLoading(false);
    }
  };

  const fetchDepositAddress = async (chainId: string) => {
    if (!accessToken) {
      setAddressError(tw('deposit.errors.signInRequired'));
      return;
    }
    try {
      setAddressLoading(true);
      setDepositAddress(null);
      setAddressError(null);
      setShowKycModal(false);
      // Use centralized api client: 401 triggers token refresh and retry automatically
      const result = await api.get<DepositAddress>(`/api/v1/wallet/deposit-address/${chainId}`);
      if (result.success && result.data?.address) {
        setDepositAddress(result.data);
        setAddressError(null);
        setShowKycModal(false);
      } else if (result.error?.code === 'KYC_REQUIRED') {
        setDepositAddress(null);
        setAddressError(tw('deposit.errors.kycRequired'));
        setShowKycModal(true);
      } else if (result.error?.code === 'SESSION_EXPIRED' || result.error?.code === 'INVALID_TOKEN') {
        setDepositAddress(null);
        setAddressError(tw('deposit.errors.sessionExpired'));
        router.push('/login');
      } else {
        setDepositAddress(null);
        const detail = (result.error as { detail?: string } | undefined)?.detail;
        setAddressError(detail || result.error?.message || tw('deposit.errors.loadAddressFailed'));
      }
    } catch (error) {
      setDepositAddress(null);
      setAddressError(tw('deposit.errors.loadAddressNetwork'));
      notifyError(tt('loadDepositAddressFailed'));
    } finally {
      setAddressLoading(false);
    }
  };

  const fetchRecentDeposits = async () => {
    if (!sessionReady) return;
    setRecentDepositsLoading(true);
    try {
      await api.post('/api/v1/wallet/deposits/sync', {}, { notifyOnError: false });
      const result = await api.get<Array<{
        id: string;
        symbol?: string;
        chainName?: string;
        amount?: string;
        txHash?: string;
        explorerUrl?: string;
        fromAddress?: string;
        toAddress?: string;
        confirmations?: number;
        requiredConfirmations?: number;
        status?: string;
        createdAt?: string;
        created_at?: string;
      }>>('/api/v1/wallet/deposit-history?limit=10');
      if (result.success && Array.isArray(result.data)) {
        const mapped: Deposit[] = result.data.map((d) => ({
          id: d.id,
          symbol: d.symbol || tw('deposit.unknown'),
          chain_name: d.chainName || tw('deposit.unknown'),
          amount: d.amount || '0',
          tx_hash: d.txHash,
          explorer_url: d.explorerUrl,
          to_address: d.fromAddress || d.toAddress || '', // show sender address
          confirmations: d.confirmations ?? 0,
          required_confirmations: d.requiredConfirmations ?? 25,
          status: d.status || 'pending',
          created_at: d.createdAt || d.created_at || '',
        }));
        setRecentDeposits(mapped);
        queryClient.invalidateQueries({ queryKey: ['balances'] });
      } else {
        setRecentDeposits([]);
      }
    } catch (error) {
      notifyError(tt('loadDepositHistoryFailed'));
      setRecentDeposits([]);
    } finally {
      setRecentDepositsLoading(false);
    }
  };

  const copyAddress = () => {
    if (depositAddress?.address) {
      navigator.clipboard.writeText(depositAddress.address);
      setCopied(true);
      toast({ title: tw('deposit.addressCopiedTitle'), description: tw('deposit.addressCopiedDesc'), variant: 'success' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const needsMemoTag = selectedToken ? MEMO_TAG_COINS.has(selectedToken.symbol.toUpperCase()) : false;

  const selectToken = (token: Token) => {
    setSelectedToken(token);
    setShowTokenDropdown(false);
    setTokenSearch('');
  };

  const selectChain = (chain: Chain) => {
    setSelectedChain(chain);
    setShowChainDropdown(false);
    setDepositAddress(null);
    // useEffect will handle fetching deposit address
  };

  const filteredTokens = tokens.filter(t => 
    t.symbol.toLowerCase().includes(tokenSearch.toLowerCase()) ||
    t.name.toLowerCase().includes(tokenSearch.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'confirming': return 'text-yellow-500';
      case 'pending': return 'text-primary';
      case 'failed': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <>
      <WalletOperationsShell
        title={tw('deposit.title')}
        description={tw('deposit.description')}
        headerRight={
          <Link
            href="/p2p"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/35 hover:bg-accent"
          >
            <span className="text-amber-500" aria-hidden>
              💰
            </span>
            {tw('deposit.buyWithFiat')}
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Section - Deposit Form */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              {/* Step 1: Choose Coin */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-medium">1</span>
                  <span className="font-medium text-foreground">{tw('deposit.step1')}</span>
                </div>

                {/* Token Dropdown */}
                <div className="relative mb-4">
                  <button
                    onClick={() => setShowTokenDropdown(!showTokenDropdown)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-background border border-border rounded-lg text-left hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
                  >
                    {selectedToken ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-accent flex items-center justify-center">
                          <CoinIcon symbol={selectedToken.symbol} size={32} />
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{selectedToken.symbol}</span>
                          <span className="text-sm text-muted-foreground ml-2">{selectedToken.name}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{tw('deposit.pleaseSelect')}</span>
                    )}
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${showTokenDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showTokenDropdown && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-96 overflow-hidden">
                      {/* Search */}
                      <div className="p-3 border-b border-border">
                        <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg">
                          <Search className="w-4 h-4 text-muted-foreground" />
                          <input
                            type="text"
                            value={tokenSearch}
                            onChange={(e) => setTokenSearch(e.target.value)}
                            placeholder={tw('deposit.searchCoin')}
                            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                            autoFocus
                          />
                        </div>
                      </div>
                      
                      {/* Token List */}
                      <div className="max-h-72 overflow-y-auto">
                        {loading ? (
                          <div className="flex justify-center py-8">
                            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                          </div>
                        ) : filteredTokens.length > 0 ? (
                          filteredTokens.map((token) => (
                            <button
                              key={token.id}
                              onClick={() => selectToken(token)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors"
                            >
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-accent flex items-center justify-center flex-shrink-0">
                                <CoinIcon symbol={token.symbol} size={32} />
                              </div>
                              <div className="flex-1 text-left">
                                <p className="font-medium text-foreground">{token.symbol}</p>
                                <p className="text-xs text-muted-foreground">{token.name}</p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="py-8 text-center text-muted-foreground">{tw('deposit.noTokens')}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Popular Tokens */}
                <div className="flex flex-wrap gap-2">
                  {POPULAR_TOKENS.map((symbol) => {
                    const token = tokens.find(t => t.symbol.toUpperCase() === symbol);
                    if (!token) return null;
                    return (
                      <button
                        key={symbol}
                        onClick={() => selectToken(token)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
                          selectedToken?.symbol.toUpperCase() === symbol
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-primary'
                            : 'bg-card dark:bg-background border-border text-foreground/80 hover:border-blue-500 dark:hover:border-blue-500'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full overflow-hidden bg-accent">
                          <CoinIcon symbol={symbol} size={20} />
                        </div>
                        <span className="text-sm font-medium">{symbol}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Choose Chain (filtered by selected asset) */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-6 h-6 rounded-full text-white text-sm flex items-center justify-center font-medium ${selectedToken ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}>2</span>
                  <span className={`font-medium ${selectedToken ? 'text-foreground' : 'text-muted-foreground'}`}>{tw('deposit.step2')}</span>
                </div>
                {selectedToken && (
                  <p className="text-xs text-muted-foreground mb-2">{tw('deposit.step2Hint', { symbol: selectedToken.symbol })}</p>
                )}

                <div className="relative">
                  <button
                    onClick={() => selectedToken && setShowChainDropdown(!showChainDropdown)}
                    disabled={!selectedToken}
                    className={`w-full flex items-center justify-between px-4 py-3 bg-background border border-border rounded-lg text-left ${
                      !selectedToken ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500 dark:hover:border-blue-500'
                    } transition-colors`}
                  >
                    {selectedChain ? (
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-accent flex items-center justify-center">
                          <Image
                            src={getChainIcon(selectedChain)}
                            alt={selectedChain.name}
                            width={24}
                            height={24}
                            className="object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <span className="font-medium text-foreground">{selectedChain.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{tw('deposit.selectChain')}</span>
                    )}
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${showChainDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showChainDropdown && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
                      {chainsLoading ? (
                        <div className="flex justify-center py-6">
                          <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                        </div>
                      ) : chainsError ? (
                        <div className="py-6 px-4 text-center">
                          <p className="text-amber-600 dark:text-amber-400 text-sm mb-1">{tw('deposit.noChainsTitle')}</p>
                          <p className="text-muted-foreground text-xs">{chainsError}</p>
                        </div>
                      ) : availableChains.length > 0 ? (
                        availableChains.map((chain) => (
                          <button
                            key={chain.id}
                            onClick={() => selectChain(chain)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full overflow-hidden bg-accent flex items-center justify-center">
                                <Image
                                  src={getChainIcon(chain)}
                                  alt={chain.name}
                                  width={24}
                                  height={24}
                                  className="object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                              <span className="font-medium text-foreground">{chain.name}</span>
                              {chain.type === 'evm' && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-primary rounded">EVM</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {tw('deposit.blockConfirms', { count: chain.confirmations_required ?? 0 })}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="py-6 text-center text-muted-foreground">{tw('deposit.noChainsEmptyDb')}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {selectedToken && selectedChain && (
                <div className="mb-4 space-y-3">
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    <div className="text-sm text-amber-900 dark:text-amber-100">
                      <p className="font-medium">{tw('deposit.warningWrongNetworkTitle')}</p>
                      <p className="mt-0.5">
                        {tw('deposit.warningWrongNetworkBody', {
                          symbol: selectedToken.symbol,
                          network: selectedChain.name,
                        })}
                      </p>
                    </div>
                  </div>
                  {needsMemoTag && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                      <div className="text-sm text-red-900 dark:text-red-100">
                        <p className="font-medium">{tw('deposit.warningMemoTitle')}</p>
                        <p className="mt-0.5">
                          {tw('deposit.warningMemoBody', { symbol: selectedToken.symbol })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Confirm Deposit Details */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-6 h-6 rounded-full text-white text-sm flex items-center justify-center font-medium ${selectedChain ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}>3</span>
                  <span className={`font-medium ${selectedChain ? 'text-foreground' : 'text-muted-foreground'}`}>{tw('deposit.step3')}</span>
                </div>

                {addressLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                  </div>
                ) : addressError ? (
                  <div className="rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-amber-800 dark:text-amber-200 text-sm">{addressError}</p>
                    <button
                      type="button"
                      onClick={() => selectedChain && fetchDepositAddress(selectedChain.id)}
                      className="mt-3 text-sm font-medium text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      {tw('deposit.retry')}
                    </button>
                  </div>
                ) : depositAddress ? (
                  <div className="bg-background rounded-lg p-4">
                    {/* QR Code */}
                    <div className="flex justify-center mb-4">
                      <div className="w-40 h-40 bg-card p-3 rounded-lg flex items-center justify-center">
                        <QRCodeSVG 
                          value={depositAddress.address}
                          size={130}
                          level="H"
                          includeMargin={false}
                          bgColor="#FFFFFF"
                          fgColor="#000000"
                        />
                      </div>
                    </div>

                    {/* Address */}
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-2">{tw('deposit.depositAddressLabel')}</p>
                      <div className="flex items-center gap-2 bg-card rounded-lg p-3 border border-border">
                        <span className="flex-1 text-sm font-mono text-foreground break-all">
                          {depositAddress.address}
                        </span>
                        <button
                          onClick={copyAddress}
                          className="flex-shrink-0 p-2 hover:bg-accent rounded-lg transition-colors"
                        >
                          {copied ? (
                            <Check className="w-5 h-5 text-green-500" />
                          ) : (
                            <Copy className="w-5 h-5 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Deposit Info */}
                    {selectedChain && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-muted rounded-lg p-3">
                          <p className="text-muted-foreground mb-0.5">{tw('deposit.confirmationsRequired')}</p>
                          <p className="text-foreground font-medium">{selectedChain.confirmations_required ?? '—'} {tw('deposit.blocks')}</p>
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                          <p className="text-muted-foreground mb-0.5">{tw('deposit.networkLabel')}</p>
                          <p className="text-foreground font-medium">{selectedChain.name} ({selectedChain.type})</p>
                        </div>
                      </div>
                    )}

                    {/* Notice */}
                    <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-800 dark:text-yellow-200">
                        <p className="font-medium mb-1">{tw('deposit.important')}</p>
                        <p>{depositAddress.notice}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {selectedChain ? tw('deposit.loadingAddress') : tw('deposit.selectCoinChainHint')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Section - FAQ */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-xl p-6 border border-border dark:border-transparent">
              <h3 className="text-lg font-semibold text-foreground mb-4">{tw('deposit.faqTitle')}</h3>
              
              <ul className="space-y-3">
                <li>
                  <Link href="/dashboard/help#deposit-how-to" className="text-sm text-muted-foreground hover:text-primary dark:hover:text-blue-400 flex items-start gap-1">
                    <span className="mt-1">•</span>
                    <span>{tw('deposit.faqHowTo')}</span>
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/help#deposit-recovery" className="text-sm text-muted-foreground hover:text-primary dark:hover:text-blue-400 flex items-start gap-1">
                    <span className="mt-1">•</span>
                    <span>{tw('deposit.faqRecovery')}</span>
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/help#deposit-faq" className="text-sm text-muted-foreground hover:text-primary dark:hover:text-blue-400 flex items-start gap-1">
                    <span className="mt-1">•</span>
                    <span>{tw('deposit.faqCrypto')}</span>
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/help#deposit-memo" className="text-sm text-muted-foreground hover:text-primary dark:hover:text-blue-400 flex items-start gap-1">
                    <span className="mt-1">•</span>
                    <span>{tw('deposit.faqMemoRecovery')}</span>
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/help#self-service" className="text-sm text-primary hover:text-primary/85 flex items-start gap-1">
                    <span className="mt-1">•</span>
                    <span>
                      {tw('deposit.faqSelfServicePrefix')}{' '}
                      <span className="text-yellow-500">{tw('deposit.faqSelfServiceAction')}</span>
                    </span>
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/help#deposit-withdraw-status" className="text-sm text-primary hover:text-primary/85 flex items-start gap-1">
                    <span className="mt-1">•</span>
                    <span>
                      {tw('deposit.faqAllCoinsStatus')}{' '}
                      <span className="text-yellow-500">{tw('deposit.faqFindOut')}</span>
                    </span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Recent Deposits */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">{tw('deposit.recentTitle')}</h2>
            <button
              onClick={fetchRecentDeposits}
              disabled={recentDepositsLoading}
              className="text-sm text-primary hover:text-primary/85 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${recentDepositsLoading ? 'animate-spin' : ''}`} />
              {recentDepositsLoading ? tw('deposit.refreshing') : tw('deposit.refresh')}
            </button>
          </div>

          <div className="bg-card rounded-xl border border-border dark:border-transparent overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-7 gap-4 px-4 py-3 bg-background border-b border-border text-sm text-muted-foreground">
              <span>{tw('deposit.tableCoin')}</span>
              <span>{tw('deposit.tableChain')}</span>
              <span>{tw('deposit.tableQty')}</span>
              <span>{tw('deposit.tableAddress')}</span>
              <span>{tw('deposit.tableTxid')}</span>
              <span className="flex items-center gap-1">
                {tw('deposit.tableStatus')} <Info className="w-3 h-3" />
              </span>
              <span>{tw('deposit.tableDateTime')}</span>
            </div>

            {/* Table Body */}
            {recentDeposits.length > 0 ? (
              <div className="divide-y divide-border">
                {recentDeposits.map((deposit) => (
                  <div key={deposit.id} className="grid grid-cols-7 gap-4 px-4 py-3 text-sm">
                    <span className="text-foreground font-medium">{deposit.symbol}</span>
                    <span className="text-muted-foreground">{deposit.chain_name}</span>
                    <span className="text-foreground">{deposit.amount}</span>
                    <span className="text-muted-foreground truncate">
                      {deposit.to_address.slice(0, 8)}...{deposit.to_address.slice(-6)}
                    </span>
                    <span className="text-muted-foreground">
                      {deposit.tx_hash ? (
                        deposit.explorer_url ? (
                          <a href={deposit.explorer_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">
                            {deposit.tx_hash.slice(0, 8)}...
                          </a>
                        ) : (
                          <span className="truncate block">{deposit.tx_hash.slice(0, 8)}...</span>
                        )
                      ) : '-'}
                    </span>
                    <span className={getStatusColor(deposit.status)}>
                      {(deposit.status === 'confirming' || deposit.status === 'pending') && deposit.required_confirmations
                        ? tw('deposit.confirmationsProgress', {
                            current: deposit.confirmations,
                            required: deposit.required_confirmations,
                          })
                        : deposit.status}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(deposit.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-20 h-20 mb-4 flex items-center justify-center">
                  <div className="text-6xl">📋</div>
                </div>
                <p className="text-muted-foreground font-medium">{tw('deposit.emptyDepositsTitle')}</p>
                <p className="mt-2 text-sm text-muted-foreground max-w-md">{tw('deposit.emptyDepositsBody')}</p>
                <Link href="/dashboard/assets/history?tab=deposit" className="mt-4 text-sm text-primary hover:underline">
                  {tw('deposit.viewFullHistory')}
                </Link>
              </div>
            )}
          </div>

          {recentDeposits.length > 0 && (
            <Link
              href="/wallet/history?tab=deposit"
              className="inline-flex items-center gap-1 mt-4 text-sm text-yellow-500 hover:text-yellow-600"
            >
              {tw('deposit.viewMore')} <ExternalLink className="w-4 h-4" />
            </Link>
          )}
        </div>
      </WalletOperationsShell>

      {/* Help Button */}
      <Link href="/dashboard/help" className="fixed bottom-6 right-6 w-12 h-12 bg-primary hover:bg-primary/85 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-40">
        <HelpCircle className="w-6 h-6" />
      </Link>

      {/* KYC Verification Modal */}
      {showKycModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-end p-4">
              <button
                onClick={() => setShowKycModal(false)}
                className="p-1 hover:bg-accent rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-8 pb-8 text-center">
              {/* Icon */}
              <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Shield className="w-10 h-10 text-primary" />
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold text-foreground mb-2">{tw('deposit.kycModalTitle')}</h2>

              {/* Description */}
              <p className="text-muted-foreground mb-2">{tw('deposit.kycModalBody')}</p>
              <Link href="/dashboard/identity" className="text-primary hover:text-primary/85 text-sm">
                {tw('deposit.kycModalWhy')}
              </Link>

              {/* Requirements */}
              <div className="mt-6 mb-6 text-left bg-background rounded-lg p-4">
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-foreground/80">
                    <Upload className="w-5 h-5 text-primary" />
                    <span>{tw('deposit.kycUploadId')}</span>
                  </li>
                  <li className="flex items-center gap-3 text-foreground/80">
                    <Camera className="w-5 h-5 text-primary" />
                    <span>{tw('deposit.kycUploadSelfie')}</span>
                  </li>
                </ul>
              </div>

              {/* CTA Button */}
              <Link
                href="/dashboard/identity"
                className="block w-full py-3 bg-primary hover:bg-primary/85 text-white font-semibold rounded-lg transition-colors"
                onClick={() => setShowKycModal(false)}
              >
                {tw('deposit.kycVerifyButton')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
