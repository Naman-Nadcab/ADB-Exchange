import type { AccountType, WithdrawPreview } from '@exchange/mobile-types';

export type WalletStackParamList = {
  AssetsHome: undefined;
  AssetDetail: { symbol: string };
  Transfer: { from?: AccountType; to?: AccountType } | undefined;
  TransferHistory: undefined;
  Convert: undefined;
  ConvertHistory: undefined;
  TransactionHistory: undefined;
  FundHistory: undefined;
  DepositHome: undefined;
  DepositNetwork: { symbol: string; name: string };
  DepositAddress: { symbol: string; chainId: string; chainName?: string; chainType?: string; confirmations?: number };
  DepositHistory: undefined;
  DepositDetail: { txHash: string };
  WithdrawHome: undefined;
  WithdrawForm: { symbol: string; name: string };
  WithdrawConfirm: {
    symbol: string;
    chainId: string;
    chainName: string;
    address: string;
    memo?: string;
    amount: string;
    preview?: WithdrawPreview;
    available: string;
    withdrawalAddressId?: string;
    needs2FA: boolean;
    needsFundPassword: boolean;
  };
  WithdrawalHistory: undefined;
  WithdrawalDetail: { withdrawalId: string };
  AddressBook: undefined;
  AddAddress: undefined;
  EditAddress: { id: string };
};
