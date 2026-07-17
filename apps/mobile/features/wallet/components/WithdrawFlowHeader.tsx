import { FlowHeader } from '@shared/ui';

type Props = {
  symbol: string;
  name?: string;
  network?: string;
  available?: string;
  withdrawEnabled?: boolean;
  step?: string;
};

/** @deprecated Use `FlowHeader` from `@shared/ui` directly. */
export function WithdrawFlowHeader({ symbol, name, network, available, withdrawEnabled, step }: Props) {
  return (
    <FlowHeader
      variant="asset"
      symbol={symbol}
      name={name}
      network={network}
      available={available}
      enabled={withdrawEnabled}
      enabledLabel="WITHDRAW ON"
      disabledLabel="MAINTENANCE"
      step={step}
    />
  );
}
