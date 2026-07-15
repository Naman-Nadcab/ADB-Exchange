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
  WithdrawHome: { coin?: string } | undefined;
  WithdrawNetwork: { symbol: string; name: string };
  WithdrawForm: {
    symbol: string;
    name: string;
    chainId?: string;
    chainName?: string;
    chainType?: string;
    confirmations?: number;
    prefillAddress?: string;
    prefillMemo?: string;
  };
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
    confirmations?: number;
    chainType?: string;
  };
  WithdrawalHistory: undefined;
  WithdrawalDetail: { withdrawalId: string; snapshot?: import('@exchange/mobile-types').WithdrawalRecord };
  AddressBook:
    | {
        selectMode?: boolean;
        symbol?: string;
        name?: string;
        chainId?: string;
        chainName?: string;
        confirmations?: number;
      }
    | undefined;
  AddAddress: undefined;
  EditAddress: { id: string };
};
