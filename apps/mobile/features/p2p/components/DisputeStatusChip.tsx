import { StatusChip } from '@shared/ui';
import type { StatusChipTone } from '@shared/theme/statusPalettes';
import { disputeStatusLabel } from '@core/domain/p2p/dispute';

type Props = { status: string };

function disputeChipTone(status: string): StatusChipTone {
  switch (status) {
    case 'open':
    case 'under_review':
      return 'warn';
    case 'resolved':
      return 'live';
    case 'closed':
    default:
      return 'neutral';
  }
}

export function DisputeStatusChip({ status }: Props) {
  return <StatusChip label={disputeStatusLabel(status)} tone={disputeChipTone(status)} />;
}
