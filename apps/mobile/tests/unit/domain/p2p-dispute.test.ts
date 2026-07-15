import { QueryClient } from '@tanstack/react-query';
import type { P2PDispute } from '@exchange/mobile-types';
import {
  buildDisputeHistoryEntries,
  disputeResolutionLabel,
  disputeStatusLabel,
  findDisputeInQueryCache,
  isTerminalDisputeStatus,
  normalizeDisputeEvidence,
  orderFiatDisplay,
  P2P_DISPUTE_QUERY_KEY,
} from '@core/domain/p2p/dispute';

const baseDispute = (over: Partial<P2PDispute> = {}): P2PDispute => ({
  id: 'disp-abc123456789',
  order_id: 'ord-abc123456789',
  status: 'open',
  reason: 'Payment was sent but seller will not release crypto.',
  evidence: ['https://example.com/proof.png'],
  order_status: 'disputed',
  order_fiat_amount: '9200',
  order_quantity: '100',
  order_fiat_currency: 'INR',
  created_at: '2026-07-15T10:00:00Z',
  ...over,
});

describe('p2p dispute domain', () => {
  it('labels dispute statuses like website', () => {
    expect(disputeStatusLabel('open')).toBe('Open');
    expect(disputeStatusLabel('resolved')).toBe('Resolved');
    expect(disputeStatusLabel('under_review')).toBe('Under Review');
  });

  it('labels resolutions from backend', () => {
    expect(disputeResolutionLabel('favor_buyer')).toBe('Favor Buyer');
    expect(disputeResolutionLabel('favor_seller')).toBe('Favor Seller');
    expect(disputeResolutionLabel('cancelled')).toBe('Cancelled');
  });

  it('detects terminal dispute statuses', () => {
    expect(isTerminalDisputeStatus('resolved')).toBe(true);
    expect(isTerminalDisputeStatus('closed')).toBe(true);
    expect(isTerminalDisputeStatus('open')).toBe(false);
  });

  it('normalizes evidence array', () => {
    expect(normalizeDisputeEvidence(['https://a.com', '', null, 1])).toEqual(['https://a.com']);
    expect(normalizeDisputeEvidence(null)).toEqual([]);
  });

  it('formats order fiat from backend fields', () => {
    expect(orderFiatDisplay(baseDispute())).toMatch(/₹/);
  });

  it('builds history from backend timestamps only', () => {
    const open = buildDisputeHistoryEntries(baseDispute());
    expect(open).toHaveLength(1);
    expect(open[0]?.label).toBe('Dispute opened');

    const resolved = buildDisputeHistoryEntries(
      baseDispute({ status: 'resolved', resolved_at: '2026-07-16T10:00:00Z' }),
    );
    expect(resolved).toHaveLength(2);
    expect(resolved[1]?.label).toBe('Dispute resolved');
  });
});

describe('p2p dispute ADR-011 cache', () => {
  it('finds dispute in query cache', () => {
    const qc = new QueryClient();
    const d = baseDispute();
    qc.setQueryData(P2P_DISPUTE_QUERY_KEY(d.id), d);
    expect(findDisputeInQueryCache(qc, d.id)?.status).toBe('open');
  });
});
