import { FlowHeader } from '@shared/ui';

type Props = {
  step?: string;
};

/** @deprecated Use `FlowHeader` from `@shared/ui` directly. */
export function ConvertFlowHeader({ step }: Props) {
  return (
    <FlowHeader
      variant="text"
      title="Convert"
      subtitle="Instant swap at live rates between assets in your selected account. No separate trading fees."
      step={step}
    />
  );
}
