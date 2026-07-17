import { FlowHeader } from '@shared/ui';

type Props = {
  step?: string;
};

/** @deprecated Use `FlowHeader` from `@shared/ui` directly. */
export function TransferFlowHeader({ step }: Props) {
  return (
    <FlowHeader
      variant="text"
      title="Internal transfer"
      subtitle="Move assets between your wallets instantly. No network fees."
      step={step}
    />
  );
}
