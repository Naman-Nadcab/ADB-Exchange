'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { useBalancesByAccount, type ByAccountRow } from '@/lib/balances';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { api } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';
import Link from 'next/link';
import Image from 'next/image';
import { CoinIcon } from '@/components/ui/CoinIcon';
import {
  ChevronDown,
  Copy,
  Check,
  HelpCircle,
  Search,
  RefreshCw,
  Wallet,
  Clock,
  TrendingUp,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  QrCode,
  CreditCard,
} from 'lucide-react';
import { WalletOperationsShell } from '@/components/wallet/WalletOperationsShell';
import { WalletWithdrawNav } from '@/components/wallet/WalletWithdrawNav';
import { toast } from '@/components/ui/toaster';
import { walletTransactionStatusLabel } from '@/lib/i18n/wallet-transaction-status';

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

interface WithdrawalLimits {
  daily: {
    limit: number;
    used: number;
    remaining: number;
    percentage: number;
  };
  monthly: {
    limit: number;
    used: number;
    remaining: number;
    percentage: number;
  };
  vipLevel: number;
}

interface WithdrawalFee {
  fee: string;
  minWithdrawal: string;
  decimals: number;
  chainName: string;
}

interface WithdrawPreview {
  fee: string;
  net_amount: string;
  min_withdrawal: string;
  fee_exceeds_amount: boolean;
}

interface Withdrawal {
  id: string;
  coin?: string;
  symbol?: string;
  chain_name?: string;
  chain_type?: string;
  amount?: string;
  quantity?: string;
  fee?: string;
  to_address?: string;
  address?: string;
  tx_hash?: string;
  txid?: string;
  status: string;
  displayStatus?: string;
  created_at?: string;
  date_time?: string;
  withdrawal_type?: string;
  internal_recipient_email?: string | null;
}

function getExplorerUrl(txHash: string, chain?: string): string {
  const c = (chain || '').toLowerCase();
  if (c.includes('btc') || c.includes('bitcoin')) return `https://mempool.space/tx/${txHash}`;
  if (c.includes('sol') || c.includes('solana')) return `https://solscan.io/tx/${txHash}`;
  if (c.includes('bsc') || c.includes('bnb')) return `https://bscscan.com/tx/${txHash}`;
  if (c.includes('polygon') || c.includes('matic')) return `https://polygonscan.com/tx/${txHash}`;
  if (c.includes('avax') || c.includes('avalanche')) return `https://snowtrace.io/tx/${txHash}`;
  if (c.includes('arb') || c.includes('arbitrum')) return `https://arbiscan.io/tx/${txHash}`;
  if (c.includes('op') || c.includes('optimism')) return `https://optimistic.etherscan.io/tx/${txHash}`;
  if (c.includes('tron') || c.includes('trx')) return `https://tronscan.org/#/transaction/${txHash}`;
  return `https://etherscan.io/tx/${txHash}`;
}

export default function WithdrawCryptoPage() {
  const tw = useTranslations('wallet');
  const faqLinks = useMemo(
    () => [
      { title: tw('withdraw.faqCryptoWithdraw'), href: '/dashboard/help' },
      { title: tw('withdraw.faqInternalTransfer'), href: '/wallet/transfer' },
      { title: tw('withdraw.faqDepositWithdrawStatus'), href: '/wallet/history' },
      { title: tw('withdraw.faqChangeLimit'), href: '/dashboard/security/withdrawal-limits' },
      { title: tw('withdraw.faqAddressBook'), href: '/dashboard/address-book' },
    ],
    [tw]
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const coinParam = searchParams.get('coin');
  const queryClient = useQueryClient();
  const { accessToken, _hasHydrated } = useAuthStore();

  // State
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [initialCoinSet, setInitialCoinSet] = useState(false);
  const [availableChains, setAvailableChains] = useState<Chain[]>([]);
  const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
  const [withdrawalLimits, setWithdrawalLimits] = useState<WithdrawalLimits | null>(null);
  const [withdrawalFee, setWithdrawalFee] = useState<WithdrawalFee | null>(null);
  const [previewData, setPreviewData] = useState<WithdrawPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [recentWithdrawals, setRecentWithdrawals] = useState<Withdrawal[]>([]);

  // Form state
  const [withdrawType, setWithdrawType] = useState<'on-chain' | 'internal'>('on-chain');
  const [toAddress, setToAddress] = useState('');
  const [withdrawMemo, setWithdrawMemo] = useState('');
  const [internalRecipient, setInternalRecipient] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<{ id: string; asset: string; network: string; address: string; memo?: string; note?: string }[]>([]);
  const [savedAddressesLoading, setSavedAddressesLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState({
    funding: true,
    trading: false,
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [fundPassword, setFundPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [chainsLoading, setChainsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [showConfirmStep, setShowConfirmStep] = useState(false);

  const API_URL = getApiBaseUrl();

  const getTokenIcon = (symbol: string) => {
    return `/assets/upload/currency-logo/${symbol.toLowerCase()}.svg`;
  };

  const getChainIcon = (chain: Chain) => {
    const iconName = chain.icon || chain.name.toLowerCase().replace(/\s+/g, '');
    const iconMapping: Record<string, string> = {
      'ethereum': 'ethereum',
      'eth': 'ethereum',
      'bnb smart chain': 'bnb',
      'bsc': 'bnb',
      'polygon': 'polygon',
      'matic': 'polygon',
      'arbitrum one': 'arbitrum',
      'arbitrum': 'arbitrum',
      'solana': 'solana',
      'sol': 'solana',
      'tron': 'tron',
      'trx': 'tron',
      'bitcoin': 'bitcoin',
      'btc': 'bitcoin',
    };
    const icon = iconMapping[iconName] || iconMapping[chain.id_text?.toLowerCase() || ''] || 'ethereum';
    return `/assets/upload/blockchain-logo/${icon}.svg`;
  };

  const { data: balancesData } = useBalancesByAccount(!!_hasHydrated && !!accessToken);
  const balances: ByAccountRow[] = balancesData ?? [];

  useEffect(() => {
    if (!_hasHydrated) return;
    fetchTokens();
    if (accessToken) {
      fetchWithdrawalLimits();
      fetchRecentWithdrawals();
    } else {
      setLoading(false);
    }
  }, [_hasHydrated, accessToken]);

  useEffect(() => {
    if (coinParam && tokens.length > 0 && !initialCoinSet) {
      const matchedToken = tokens.find((t) => t.symbol.toUpperCase() === coinParam.toUpperCase());
      if (matchedToken) {
        setSelectedToken(matchedToken);
        setInitialCoinSet(true);
      }
    }
  }, [coinParam, tokens, initialCoinSet]);

  useEffect(() => {
    if (selectedToken) {
      fetchChainsForToken(selectedToken.symbol);
    }
  }, [selectedToken]);

  useEffect(() => {
    if (selectedToken && selectedChain) {
      fetchWithdrawalFee(selectedToken.symbol, selectedChain.id);
    }
  }, [selectedToken, selectedChain]);

  // Debounced withdrawal preview when amount changes (fee + net amount)
  useEffect(() => {
    if (!_hasHydrated || !accessToken || !selectedToken || !amount || parseFloat(amount) <= 0) {
      setPreviewData(null);
      return;
    }
    const isInternal = withdrawType === 'internal';
    if (isInternal) {
      setPreviewData({ fee: '0', net_amount: amount, min_withdrawal: '0', fee_exceeds_amount: false });
      return;
    }
    if (!selectedChain) {
      setPreviewData(null);
      return;
    }
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const params = new URLSearchParams({
          symbol: selectedToken.symbol,
          chainId: selectedChain.id,
          amount,
          type: 'onchain',
        });
        const res = await fetch(`${API_URL}/api/v1/wallet/withdraw/preview?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (data.success && data.data) {
          setPreviewData(data.data);
        } else {
          setPreviewData(null);
        }
      } catch {
        setPreviewData(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [_hasHydrated, accessToken, selectedToken, selectedChain, amount, withdrawType]);

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
      console.error('Failed to fetch tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawalLimits = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/wallet/withdrawal-limits`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setWithdrawalLimits(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch withdrawal limits:', error);
    }
  };

  const fetchChainsForToken = async (symbol: string) => {
    try {
      setChainsLoading(true);
      setSelectedChain(null);
      setWithdrawalFee(null);
      const res = await fetch(`${API_URL}/api/v1/wallet/tokens/${symbol}/chains`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const chains = Array.isArray(data.data) ? data.data : [];
          setAvailableChains(chains);
          if (chains.length === 1) setSelectedChain(chains[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch chains:', error);
    } finally {
      setChainsLoading(false);
    }
  };

  const fetchWithdrawalFee = async (symbol: string, chainId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/wallet/withdrawal-fee/${symbol}/${chainId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setWithdrawalFee(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch withdrawal fee:', error);
    }
  };

  const fetchRecentWithdrawals = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/wallet/withdrawals?limit=10`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRecentWithdrawals(data.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error);
    }
  };

  const fetchSavedAddresses = async () => {
    if (!accessToken) return;
    setSavedAddressesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/withdrawal-addresses`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.addresses)) {
        setSavedAddresses(data.data.addresses);
      } else {
        setSavedAddresses([]);
      }
    } catch {
      setSavedAddresses([]);
    } finally {
      setSavedAddressesLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken && withdrawType === 'on-chain') fetchSavedAddresses();
  }, [accessToken, withdrawType]);

  const matchingAddresses = useMemo(() => {
    if (!selectedToken || !selectedChain) return [];
    const sym = (selectedToken.symbol || '').toUpperCase();
    const chainName = (selectedChain.name || '').toLowerCase();
    const chainId = (selectedChain.id || '').toLowerCase();
    return savedAddresses.filter((a) => {
      const aAsset = (a.asset || '').toUpperCase();
      const aNet = (a.network || '').toLowerCase();
      if (aAsset !== sym) return false;
      return aNet.includes(chainName) || aNet.includes(chainId) || chainName.includes(aNet);
    });
  }, [savedAddresses, selectedToken, selectedChain]);

  const selectSavedAddress = (addr: { address: string; memo?: string }) => {
    setToAddress(addr.address);
    setWithdrawMemo(addr.memo || '');
  };

  const selectToken = (token: Token) => {
    setSelectedToken(token);
    setShowTokenDropdown(false);
    setTokenSearch('');
    setAmount('');
    setToAddress('');
    setWithdrawMemo('');
  };

  const selectChain = (chain: Chain) => {
    setSelectedChain(chain);
    setShowChainDropdown(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const safeNum = (v: string | number | undefined): number => {
    const n = parseFloat(String(v ?? '0'));
    return Number.isFinite(n) ? n : 0;
  };

  const getAvailableBalance = (): number => {
    if (!selectedToken || !Array.isArray(balances)) return 0;
    const sym = (selectedToken.symbol || '').toUpperCase();
    const tokenBalance = balances.find(b => (b?.symbol || '').toUpperCase() === sym);
    if (!tokenBalance) return 0;
    const accountType = selectedAccounts.funding ? 'funding' : 'trading';
    return safeNum(accountType === 'funding' ? tokenBalance.funding : tokenBalance.trading);
  };

  const getWithdrawFee = (): number => {
    if (withdrawType === 'internal') return 0;
    if (previewData) return safeNum(previewData.fee);
    if (withdrawalFee) return safeNum(withdrawalFee.fee);
    return 0;
  };

  const getReceivedAmount = (): number => {
    if (!amount) return 0;
    const amountNum = safeNum(amount);
    if (withdrawType === 'internal') return amountNum;
    if (previewData) return safeNum(previewData.net_amount);
    if (withdrawalFee) return Math.max(0, amountNum - safeNum(withdrawalFee.fee));
    return 0;
  };

  const setMaxAmount = () => {
    const available = getAvailableBalance();
    const fee = getWithdrawFee();
    if (withdrawType === 'internal') {
      setAmount(available.toString());
    } else {
      const maxSend = Math.max(0, available - fee);
      setAmount(maxSend.toString());
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const isInternal = withdrawType === 'internal';
    if (!selectedToken || !amount) {
      setError(tw('withdraw.errors.selectCoinAmount'));
      return;
    }
    if (isInternal) {
      if (!internalRecipient.trim()) {
        setError(tw('withdraw.errors.recipientRequired'));
        return;
      }
    } else {
      if (!selectedChain || !toAddress.trim()) {
        setError(tw('withdraw.errors.chainAddressRequired'));
        return;
      }
    }
    if (!accessToken) {
      router.push('/login');
      return;
    }
    setError('');
    setSuccessMessage(null);
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        symbol: selectedToken.symbol,
        amount,
        type: isInternal ? 'internal' : 'onchain',
        accountType: selectedAccounts.funding ? 'funding' : 'trading',
      };
      if (isInternal) {
        body.internal_user_identifier = internalRecipient.trim();
      } else {
        body.chainId = selectedChain!.id;
        body.toAddress = toAddress.trim();
        if (withdrawMemo.trim()) body.memo = withdrawMemo.trim();
      }
      if (twoFactorCode.trim()) body.twoFactorCode = twoFactorCode.trim();
      if (fundPassword) body.fund_password = fundPassword;
      const data = await api.post<{
        id?: string;
        status?: string;
        type?: string;
      }>('/api/v1/wallet/withdrawals', body, {
        notifyOnError: false,
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      });
      if (data.success) {
        setShowConfirmStep(false);
        setAmount('');
        setToAddress('');
        setWithdrawMemo('');
        setInternalRecipient('');
        setTwoFactorCode('');
        setFundPassword('');
        queryClient.invalidateQueries({ queryKey: ['balances'] });
        fetchWithdrawalLimits();
        fetchRecentWithdrawals();
        const status = data.data?.status;
        const type = data.data?.type;
        if (type === 'internal' && status === 'completed') {
          setSuccessMessage(tw('withdraw.successTransferCompleted'));
        } else if (status === 'pending_approval') {
          setSuccessMessage(tw('withdraw.successPendingApproval'));
        } else {
          setSuccessMessage(tw('withdraw.successSubmitted'));
        }
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        const code = data.error?.code;
        if (code === '2FA_REQUIRED') {
          setError(tw('withdraw.errors.twoFaRequired'));
        } else if (code === 'FUND_PASSWORD_REQUIRED') {
          setError(tw('withdraw.errors.fundPasswordRequired'));
        } else if (code === 'INVALID_2FA' || code === 'INVALID_FUND_PASSWORD') {
          setError(data.error?.message || tw('withdraw.errors.invalidCodeOrPassword'));
        } else if (code === 'BELOW_MINIMUM') {
          setError(data.error?.message || tw('withdraw.errors.belowMinimum'));
        } else if (code === 'INSUFFICIENT_BALANCE' || code === 'INSUFFICIENT_FUNDS') {
          setError(data.error?.message || tw('withdraw.errors.insufficientBalance'));
        } else if (code === 'NETWORK_ERROR') {
          setError(tw('withdraw.errors.networkError'));
        } else {
          setError(data.error?.message || tw('withdraw.errors.submitFailed'));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg.includes('JSON') || msg.includes('fetch')
          ? tw('withdraw.errors.networkError')
          : msg || tw('withdraw.errors.networkError')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cancelWithdrawal = async (id: string) => {
    if (!accessToken) return;
    setCancelError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/wallet/withdrawals/${id}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Idempotency-Key': crypto.randomUUID(),
        },
      });
      const data = await res.json();
      if (data.success) {
        setCancelConfirmId(null);
        queryClient.invalidateQueries({ queryKey: ['balances'] });
        fetchRecentWithdrawals();
      } else {
        setCancelError(data.error?.message || tw('withdraw.errors.cancelFailed'));
      }
    } catch (error) {
      console.error('Failed to cancel withdrawal:', error);
      setCancelError(tw('withdraw.errors.connectionRetry'));
    }
  };

  const filteredTokens = tokens.filter(t =>
    t.symbol.toLowerCase().includes(tokenSearch.toLowerCase()) ||
    t.name.toLowerCase().includes(tokenSearch.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    const styles: Record<string, string> = {
      completed: 'bg-green-100 dark:bg-green-900/30 text-buy',
      processing: 'bg-blue-100 dark:bg-blue-900/30 text-primary',
      pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      pending_approval: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      queued: 'bg-blue-100 dark:bg-blue-900/30 text-primary',
      signed: 'bg-blue-100 dark:bg-blue-900/30 text-primary',
      broadcasted: 'bg-blue-100 dark:bg-blue-900/30 text-primary',
      failed: 'bg-red-100 dark:bg-red-900/30 text-destructive',
      rejected: 'bg-red-100 dark:bg-red-900/30 text-destructive',
      cancelled: 'bg-accent text-muted-foreground',
    };
    return styles[s] || styles.cancelled;
  };

  const formatAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  return (
    <>
      <WalletOperationsShell
        title={tw('withdraw.titleCrypto')}
        description={tw('withdraw.description')}
      >
        <div className="mb-6 max-w-4xl">
          <WalletWithdrawNav />
        </div>
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 dark:border-amber-800/40 dark:bg-amber-950/25">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{tw('withdraw.bannerIrreversibleTitle')}</p>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-1">{tw('withdraw.bannerIrreversibleBody')}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Withdrawal Form */}
            <div className="lg:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {/* Form Content */}
                <div className="p-6">
                  {/* Select Coin */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-foreground/80">{tw('withdraw.selectCoin')}</label>
                      <span className="text-xs text-muted-foreground">{tw('withdraw.coinShort')}</span>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowTokenDropdown(!showTokenDropdown)}
                        className="w-full flex items-center justify-between px-4 py-3.5 bg-muted dark:bg-[#2b2f36] border border-border rounded-xl text-left hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                      >
                        {selectedToken ? (
                          <div className="flex items-center gap-3">
                            <CoinIcon symbol={selectedToken.symbol} size={28} />
                            <div>
                              <span className="font-semibold text-foreground">{selectedToken.symbol}</span>
                              <span className="text-sm text-muted-foreground ml-2">{selectedToken.name}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{tw('withdraw.pleaseSelect')}</span>
                        )}
                        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${showTokenDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showTokenDropdown && (
                        <div className="absolute z-30 top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                          <div className="p-3 border-b border-border">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <input
                                type="text"
                                value={tokenSearch}
                                onChange={(e) => setTokenSearch(e.target.value)}
                                placeholder={tw('withdraw.searchCoin')}
                                className="w-full pl-10 pr-4 py-2.5 bg-muted dark:bg-[#2b2f36] border-0 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {loading ? (
                              <div className="flex justify-center py-8">
                                <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                              </div>
                            ) : filteredTokens.length > 0 ? (
                              filteredTokens.slice(0, 50).map((token) => (
                                <button
                                  key={token.id}
                                  onClick={() => selectToken(token)}
                                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors"
                                >
                                  <Image
                                    src={getTokenIcon(token.symbol)}
                                    alt={token.symbol}
                                    width={28}
                                    height={28}
                                    className="rounded-full"
                                    unoptimized
                                  />
                                  <div className="text-left">
                                    <p className="font-medium text-foreground">{token.symbol}</p>
                                    <p className="text-xs text-muted-foreground">{token.name}</p>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="py-8 text-center text-muted-foreground text-sm">{tw('withdraw.noTokens')}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Withdraw To Tabs */}
                  <div className="mb-6">
                    <label className="text-sm font-medium text-foreground/80 mb-3 block">{tw('withdraw.withdrawTo')}</label>
                    <div className="flex gap-1 p-1 bg-accent dark:bg-[#2b2f36] rounded-xl w-fit">
                      <button
                        onClick={() => setWithdrawType('on-chain')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                          withdrawType === 'on-chain'
                            ? 'bg-card text-primary shadow-sm'
                            : 'text-muted-foreground hover:text-foreground/80 dark:hover:text-gray-300'
                        }`}
                      >
                        {tw('withdraw.onChain')}
                      </button>
                      <button
                        onClick={() => setWithdrawType('internal')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                          withdrawType === 'internal'
                            ? 'bg-card text-primary shadow-sm'
                            : 'text-muted-foreground hover:text-foreground/80 dark:hover:text-gray-300'
                        }`}
                      >
                        {tw('withdraw.internalTransfer')}
                      </button>
                    </div>
                  </div>

                  {withdrawType === 'on-chain' ? (
                    <>
                      {/* Address Book Picker */}
                      {selectedToken && selectedChain && matchingAddresses.length > 0 && (
                        <div className="mb-4">
                          <label className="text-sm text-muted-foreground mb-2 block">{tw('withdraw.savedAddress')}</label>
                          <select
                            value=""
                            onChange={(e) => {
                              const idx = e.target.value;
                              if (idx) {
                                const addr = matchingAddresses[parseInt(idx, 10)];
                                if (addr) selectSavedAddress(addr);
                              }
                            }}
                            className="w-full px-4 py-2.5 bg-muted dark:bg-[#2b2f36] border border-border rounded-xl text-foreground text-sm focus:border-blue-500 outline-none"
                          >
                            <option value="">{tw('withdraw.selectFromAddressBook')}</option>
                            {matchingAddresses.map((addr, i) => (
                              <option key={addr.id} value={i}>
                                {addr.note || addr.address.slice(0, 12) + '…'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {/* Wallet Address */}
                      <div className="mb-6">
                        <label className="text-sm text-muted-foreground mb-2 block">{tw('withdraw.walletAddress')}</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={toAddress}
                            onChange={(e) => setToAddress(e.target.value)}
                            placeholder={tw('withdraw.addressPlaceholder')}
                            className="w-full px-4 py-3.5 pr-12 bg-muted dark:bg-[#2b2f36] border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => toast({ title: tw('withdraw.qrScannerTitle'), description: tw('withdraw.qrScannerDesc') })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-accent rounded-lg transition-colors"
                          >
                            <QrCode className="w-5 h-5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                      <div className="mb-6">
                        <label className="text-sm text-muted-foreground mb-2 block">{tw('withdraw.memoOptional')}</label>
                        <input
                          type="text"
                          value={withdrawMemo}
                          onChange={(e) => setWithdrawMemo(e.target.value)}
                          placeholder={tw('withdraw.memoPlaceholder')}
                          className="w-full px-4 py-2.5 bg-muted dark:bg-[#2b2f36] border border-border rounded-xl text-foreground text-sm"
                        />
                      </div>

                      {/* Chain Type */}
                      <div className="mb-6">
                        <label className="text-sm text-muted-foreground mb-2 block">{tw('withdraw.chainType')}</label>
                        <div className="relative">
                          <button
                            onClick={() => selectedToken && setShowChainDropdown(!showChainDropdown)}
                            disabled={!selectedToken}
                            className={`w-full flex items-center justify-between px-4 py-3.5 bg-muted dark:bg-[#2b2f36] border border-border rounded-xl text-left ${
                              !selectedToken ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 dark:hover:border-blue-500'
                            } transition-colors`}
                          >
                            {selectedChain ? (
                              <div className="flex items-center gap-3">
                                <Image
                                  src={getChainIcon(selectedChain)}
                                  alt={selectedChain.name}
                                  width={24}
                                  height={24}
                                  className="rounded-full"
                                  unoptimized
                                />
                                <span className="font-medium text-foreground">{selectedChain.name}</span>
                                {selectedChain.type === 'evm' && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-primary rounded-full">EVM</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">{tw('withdraw.selectChain')}</span>
                            )}
                            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${showChainDropdown ? 'rotate-180' : ''}`} />
                          </button>

                          {showChainDropdown && (
                            <div className="absolute z-30 top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                              {chainsLoading ? (
                                <div className="flex justify-center py-6">
                                  <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                                </div>
                              ) : availableChains.length > 0 ? (
                                availableChains.map((chain) => (
                                  <button
                                    key={chain.id}
                                    onClick={() => selectChain(chain)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Image
                                        src={getChainIcon(chain)}
                                        alt={chain.name}
                                        width={24}
                                        height={24}
                                        className="rounded-full"
                                        unoptimized
                                      />
                                      <span className="font-medium text-foreground">{chain.name}</span>
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="py-6 text-center text-muted-foreground text-sm">{tw('withdraw.noChains')}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mb-6">
                      <label className="text-sm text-muted-foreground mb-2 block">{tw('withdraw.recipientLabel')}</label>
                      <input
                        type="text"
                        value={internalRecipient}
                        onChange={(e) => setInternalRecipient(e.target.value)}
                        placeholder={tw('withdraw.recipientPlaceholder')}
                        className="w-full px-4 py-3.5 bg-muted dark:bg-[#2b2f36] border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                  )}

                  {/* Amount */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-muted-foreground">{tw('withdraw.withdrawableAmount')}</label>
                      <div className="flex items-center gap-2">
                        {selectedToken && (
                          <span className="text-xs text-muted-foreground">
                            {tw('withdraw.available', {
                              amount: getAvailableBalance().toFixed(8),
                              symbol: selectedToken.symbol,
                            })}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{tw('withdraw.amountShort')}</span>
                        <Link href="/dashboard/security/withdrawal-limits" className="text-xs text-primary hover:text-primary/85 font-medium">{tw('withdraw.raiseLimit')}</Link>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className="w-full px-4 py-3.5 pr-16 bg-muted dark:bg-[#2b2f36] border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                      />
                      <button
                        onClick={setMaxAmount}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-primary hover:text-primary/85 font-medium"
                      >
                        {tw('withdraw.maxAll')}
                      </button>
                    </div>

                    {/* Account Selection */}
                    <div className="mt-4 p-4 bg-muted dark:bg-[#2b2f36] rounded-xl">
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                        <span>{tw('withdraw.selectAccount', { count: selectedAccounts.funding || selectedAccounts.trading ? 1 : 0 })}</span>
                        <span className="font-medium text-foreground">
                          {selectedToken ? getAvailableBalance().toFixed(8) : '0'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center justify-between p-3 bg-card rounded-xl cursor-pointer border border-border hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedAccounts.funding}
                              onChange={(e) => setSelectedAccounts({ ...selectedAccounts, funding: e.target.checked })}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                              <Wallet className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-foreground/80 font-medium">{tw('withdraw.funding')}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {(selectedToken && (balances || []).find(b => (b?.symbol || '').toUpperCase() === (selectedToken.symbol || '').toUpperCase())?.funding) ?? '0'}
                          </span>
                        </label>
                        <label className="flex items-center justify-between p-3 bg-card rounded-xl cursor-pointer border border-border hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedAccounts.trading}
                              onChange={(e) => setSelectedAccounts({ ...selectedAccounts, trading: e.target.checked })}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                              <TrendingUp className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-foreground/80 font-medium">{tw('withdraw.unifiedTrading')}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {(selectedToken && (balances || []).find(b => (b?.symbol || '').toUpperCase() === (selectedToken.symbol || '').toUpperCase())?.trading) ?? '0'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Fee & Received (from preview when amount entered) */}
                  <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 mb-6">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{tw('withdraw.transactionFee')}</span>
                      <span className="font-medium text-foreground">
                        {withdrawType === 'internal'
                          ? `0 ${selectedToken?.symbol || ''}`
                          : previewLoading
                            ? '...'
                            : (previewData ? `${previewData.fee} ${selectedToken?.symbol || ''}` : withdrawalFee ? `${withdrawalFee.fee} ${selectedToken?.symbol || ''}` : '--')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{tw('withdraw.amountReceived')}</span>
                      <span className="font-semibold text-foreground">
                        {withdrawType === 'internal'
                          ? (amount ? `${amount} ${selectedToken?.symbol || ''}` : '--')
                          : previewLoading
                            ? '...'
                            : (amount ? `${getReceivedAmount().toFixed(8)} ${selectedToken?.symbol || ''}` : '--')}
                      </span>
                    </div>
                    {previewData?.min_withdrawal && parseFloat(previewData.min_withdrawal) > 0 && (
                      <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-border/50">
                        <span className="text-muted-foreground">{tw('withdraw.minWithdrawal')}</span>
                        <span className="text-foreground">{previewData.min_withdrawal} {selectedToken?.symbol || ''}</span>
                      </div>
                    )}
                    {previewData?.fee_exceeds_amount && (
                      <p className="text-amber-600 dark:text-amber-400 text-sm mt-2">{tw('withdraw.feeExceedsAmount')}</p>
                    )}
                  </div>

                  {/* Success */}
                  {successMessage && (
                    <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl mb-6">
                      <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-6">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}

                  {/* Confirmation step: summary + Back / Confirm */}
                  {showConfirmStep && selectedToken && (
                    <div className="mb-6 p-4 rounded-xl bg-background border border-border">
                      <p className="text-sm font-medium text-foreground/80 mb-3">{tw('withdraw.reviewTitle')}</p>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">{tw('withdraw.labelCoin')}</dt>
                          <dd className="font-medium text-foreground">{selectedToken.symbol}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">{tw('withdraw.labelAmount')}</dt>
                          <dd className="font-mono text-foreground">{amount} {selectedToken.symbol}</dd>
                        </div>
                        {withdrawType === 'on-chain' && selectedChain && (
                          <>
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">{tw('withdraw.network')}</dt>
                              <dd className="font-medium text-foreground">{selectedChain.name}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">{tw('withdraw.fee')}</dt>
                              <dd className="font-mono text-foreground">{getWithdrawFee().toFixed(8)} {selectedToken.symbol}</dd>
                            </div>
                            <div className="flex justify-between items-start gap-2">
                              <dt className="text-muted-foreground shrink-0">{tw('withdraw.labelAddress')}</dt>
                              <dd className="font-mono text-xs text-foreground break-all text-right">{toAddress.trim()}</dd>
                            </div>
                          </>
                        )}
                        {withdrawType === 'internal' && (
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">{tw('withdraw.labelRecipient')}</dt>
                            <dd className="font-medium text-foreground">{internalRecipient.trim()}</dd>
                          </div>
                        )}
                      </dl>
                      <p className="text-xs text-muted-foreground mt-3 mb-2">{tw('withdraw.securityHint')}</p>
                      <div className="space-y-3 mt-2">
                        <div>
                          <label htmlFor="withdraw-2fa" className="block text-xs font-medium text-muted-foreground mb-1">{tw('withdraw.twoFaLabel')}</label>
                          <input
                            id="withdraw-2fa"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="000000"
                            maxLength={8}
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                            className="w-full px-3 py-2 bg-card dark:bg-[#2b2f36] border border-border rounded-lg text-foreground text-sm font-mono focus:ring-2 focus:ring-primary focus:border-blue-500 outline-none"
                            aria-label={tw('withdraw.twoFaAria')}
                          />
                        </div>
                        <div>
                          <label htmlFor="withdraw-fund-password" className="block text-xs font-medium text-muted-foreground mb-1">{tw('withdraw.fundPasswordLabel')}</label>
                          <input
                            id="withdraw-fund-password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={fundPassword}
                            onChange={(e) => setFundPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-card dark:bg-[#2b2f36] border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-blue-500 outline-none"
                            aria-label={tw('withdraw.fundPasswordAria')}
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 mt-4">
                        <button
                          type="button"
                          onClick={() => setShowConfirmStep(false)}
                          disabled={submitting}
                          aria-label={tw('withdraw.backAria')}
                          className="flex-1 py-2.5 rounded-xl font-medium border border-border dark:border-gray-600 text-foreground/80 hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        >
                          {tw('withdraw.back')}
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={submitting}
                          aria-busy={submitting}
                          aria-label={tw('withdraw.confirmSubmitAria')}
                          className="flex-1 py-2.5 rounded-xl font-semibold bg-primary hover:bg-primary/85 text-white disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        >
                          {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                          {tw('withdraw.confirmWithdrawal')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Submit / Review Button */}
                  {!showConfirmStep && (() => {
                    const isInternal = withdrawType === 'internal';
                    const amountNum = parseFloat(amount || '0');
                    const amountInvalid = !amount || isNaN(amountNum) || amountNum <= 0;
                    const fee = getWithdrawFee();
                    const totalRequired = isInternal ? amountNum : amountNum + fee;
                    const available = getAvailableBalance();
                    const epsilon = 1e-8;
                    const balanceInsufficient = totalRequired > available + epsilon;
                    const feeExceedsAmount = !!previewData?.fee_exceeds_amount;
                    const validInternal = selectedToken && amount && internalRecipient.trim() && !amountInvalid && !balanceInsufficient;
                    const validOnChain = selectedToken && selectedChain && amount && toAddress.trim() && !amountInvalid && !balanceInsufficient && !feeExceedsAmount;
                    const isValid = isInternal ? validInternal : validOnChain;
                    return (
                      <button
                        type="button"
                        onClick={() => setShowConfirmStep(true)}
                        disabled={!isValid}
                        aria-label={tw('withdraw.reviewButtonAria')}
                        className={`w-full py-3.5 rounded-xl font-semibold transition-all ${
                          isValid
                            ? 'bg-primary hover:bg-primary/85 text-white shadow-lg shadow-blue-500/25'
                            : 'bg-accent text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        {tw('withdraw.reviewButton')}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Right Side - FAQ */}
            <div className="space-y-6">
              {/* FAQ */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">{tw('deposit.faqTitle')}</h3>
                <ul className="space-y-3">
                  {faqLinks.map((link, index) => (
                    <li key={index}>
                      <Link href={link.href} className="flex items-start gap-2 text-sm text-muted-foreground hover:text-primary dark:hover:text-blue-400 transition-colors">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{link.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Withdrawal Limits */}
              {withdrawalLimits && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-muted-foreground">{tw('withdraw.dailyRemainingLimit')}</p>
                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-primary rounded-full font-medium">
                      VIP {withdrawalLimits.vipLevel}
                    </span>
                  </div>
                  <div className="h-2 bg-accent rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                      style={{ width: `${100 - Math.min(withdrawalLimits.daily.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm mb-4">
                    <span className="font-semibold text-primary">
                      {tw('withdraw.percentRemaining', {
                        percent: ((1 - withdrawalLimits.daily.percentage / 100) * 100).toFixed(0),
                      })}
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {withdrawalLimits.daily.remaining.toLocaleString()}
                      </span>
                      /{withdrawalLimits.daily.limit.toLocaleString()} USDT
                    </span>
                  </div>
                  <Link
                    href="/dashboard/security/withdrawal-limits"
                    className="flex items-center gap-1 text-sm text-primary hover:text-primary/85 font-medium"
                  >
                    {tw('withdraw.manageLimit')}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Recent Withdrawals */}
          <div className="mt-8">
            {cancelError && (
              <div className="mb-4 flex items-center justify-between gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                <span className="min-w-0 flex-1">{cancelError}</span>
                <button type="button" onClick={() => setCancelError(null)} className="flex-shrink-0 p-1 rounded hover:bg-red-200/50 dark:hover:bg-red-800/30 transition-colors" aria-label={tw('withdraw.dismiss')}>×</button>
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">{tw('withdraw.recentRecords')}</h2>
              <Link
                href="/wallet/history?tab=withdraw"
                className="text-sm text-primary hover:text-primary/85 font-medium flex items-center gap-1"
              >
                {tw('withdraw.viewAll')}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-card rounded-lg border border-border overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-8 gap-4 px-6 py-4 bg-background border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>{tw('withdraw.tableCoin')}</span>
                <span>{tw('withdraw.tableChain')}</span>
                <span>{tw('withdraw.tableQty')}</span>
                <span>{tw('withdraw.tableFee')}</span>
                <span>{tw('withdraw.tableAddress')}</span>
                <span>{tw('withdraw.tableTxid')}</span>
                <span>{tw('withdraw.tableStatus')}</span>
                <span>{tw('withdraw.tableDateTime')}</span>
              </div>

              {/* Table Body */}
              {recentWithdrawals.length > 0 ? (
                <div className="divide-y divide-border">
                  {recentWithdrawals.map((withdrawal) => {
                    const coin = withdrawal.coin ?? withdrawal.symbol ?? '—';
                    const chainLabel = withdrawal.chain_type ?? withdrawal.chain_name ?? '—';
                    const qty = withdrawal.quantity ?? withdrawal.amount ?? '0';
                    const toLabel = withdrawal.withdrawal_type === 'internal'
                      ? (withdrawal.internal_recipient_email ?? tw('withdraw.internalRecipientShort'))
                      : (withdrawal.address ?? withdrawal.to_address ?? '—');
                    const txHash = withdrawal.txid ?? withdrawal.tx_hash;
                    const dateStr = withdrawal.date_time ?? withdrawal.created_at ?? '';
                    const displayStatus = withdrawal.displayStatus
                      ? withdrawal.displayStatus
                      : walletTransactionStatusLabel(withdrawal.status, tw);
                    return (
                    <div key={withdrawal.id} className="grid grid-cols-8 gap-4 px-6 py-4 text-sm items-center hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <CoinIcon symbol={coin} size={24} />
                        <span className="font-medium text-foreground">{coin}</span>
                      </div>
                      <span className="text-muted-foreground">{chainLabel}</span>
                      <span className="font-medium text-foreground">{parseFloat(String(qty)).toFixed(6)}</span>
                      <span className="text-muted-foreground">{withdrawal.fee ?? '0'}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground font-mono text-xs" title={toLabel}>{withdrawal.withdrawal_type === 'internal' ? toLabel : formatAddress(toLabel)}</span>
                        {withdrawal.withdrawal_type !== 'internal' && (
                          <button
                            onClick={() => copyToClipboard(toLabel, `addr-${withdrawal.id}`)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            {copied === `addr-${withdrawal.id}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {txHash ? (
                          <>
                            <span className="text-primary font-mono text-xs">{formatAddress(txHash)}</span>
                            <a
                              href={selectedChain?.explorer_url ? `${selectedChain.explorer_url.replace(/\/$/, '')}/tx/${txHash}` : getExplorerUrl(txHash, withdrawal.chain_type ?? withdrawal.chain_name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(withdrawal.status)}`}>
                        {displayStatus}
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">
                          {dateStr ? `${new Date(dateStr).toLocaleDateString()} ${new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                        </span>
                        {withdrawal.status === 'pending' && withdrawal.withdrawal_type !== 'internal' && (
                          cancelConfirmId === withdrawal.id ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setCancelConfirmId(null)}
                                className="text-xs text-muted-foreground hover:text-foreground font-medium"
                              >
                                {tw('withdraw.keep')}
                              </button>
                              <button
                                type="button"
                                onClick={() => void cancelWithdrawal(withdrawal.id)}
                                className="text-xs text-red-500 hover:text-red-600 font-semibold"
                              >
                                {tw('withdraw.confirmCancel')}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCancelConfirmId(withdrawal.id)}
                              className="text-xs text-red-500 hover:text-red-600 font-medium"
                            >
                              {tw('withdraw.cancel')}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-20 h-20 bg-accent rounded-xl flex items-center justify-center mb-4">
                    <Clock className="w-10 h-10 text-gray-300 dark:text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">{tw('withdraw.noRecords')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{tw('withdraw.noRecordsHint')}</p>
                </div>
              )}
            </div>
          </div>
      </WalletOperationsShell>

      <Link
        href="/dashboard/help#withdraw-crypto"
        aria-label={tw('withdraw.helpAria')}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
      >
        <HelpCircle className="h-6 w-6" />
      </Link>
    </>
  );
}
