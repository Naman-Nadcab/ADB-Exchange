import { FlowHeader } from '@shared/ui';

type Props = {
  symbol: string;
  name?: string;
  network?: string;
  depositEnabled?: boolean;
  step?: string;
};

/** @deprecated Use `FlowHeader` from `@shared/ui` directly. */
export function DepositFlowHeader({ symbol, name, network, depositEnabled, step }: Props) {
  return (
    <FlowHeader
      variant="asset"
      symbol={symbol}
      name={name}
      network={network}
      enabled={depositEnabled}
      enabledLabel="DEPOSIT ON"
      disabledLabel="MAINTENANCE"
      step={step}
    />
  );
}
