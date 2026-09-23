/**
 * Read-only customer account-management bundle for a single owned accountId.
 * IDOR: caller must verify ownership before invoking.
 */
import { getForexAccountingService } from '../accounting/service.js';
import { publicLedgerRow } from '../accounting/ledger-public.js';
import { publicForexOrder } from '../orders/models.js';
import { getForexOrderService } from '../orders/service.js';
import { publicForexPosition } from '../positions/models.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';
import { getForexRiskService } from '../risk/service.js';
import { getForexAdminBackendConfig } from '../admin/config.js';
import type { ForexCustomerAccountRow } from './accounts-service.js';

const PREVIEW_LIMIT = 8;

function accounting() {
  const pricing = getForexPricingService();
  return getForexAccountingService(getForexPositionService(pricing), pricing);
}

function risk() {
  const pricing = getForexPricingService();
  return getForexRiskService(getForexPositionService(pricing), pricing);
}

function positions() {
  return getForexPositionService(getForexPricingService());
}

function orders() {
  return getForexOrderService();
}

export function buildForexCustomerAccountHubBundle(account: ForexCustomerAccountRow, activeAccountId: string) {
  const accountId = account.accountId;
  const view = accounting().accountView(accountId);
  const riskStatus = risk().status(accountId);
  const openPositions = positions().listOwned(accountId, true).map(publicForexPosition);
  const ownedOrders = orders().listOwned(accountId);
  const pendingOrders = orders().listPending(accountId);
  const recentOrders = [...ownedOrders]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, PREVIEW_LIMIT)
    .map(publicForexOrder);
  const fills = orders().listFills(accountId).slice(0, PREVIEW_LIMIT);

  const adminCfg = getForexAdminBackendConfig();

  return {
    source: 'SIMULATED' as const,
    executionMode: 'MOCK' as const,
    realForex: adminCfg.realForex === true,
    activeAccountId,
    isSelected: activeAccountId === accountId,
    account: {
      accountId: account.accountId,
      platformCustomerId: account.userId,
      currency: account.currency,
      status: account.status,
      accountKind: account.accountKind,
      label: `${account.accountKind} · ${account.currency}`,
      positionMode: account.positionMode,
      leverageOverride: account.leverageOverride,
      groupCode: account.groupCode,
      groupLabel: account.groupLabel,
      tradingLogin: account.accountId,
      brokerTradingLogin: null as string | null,
      server: 'FDM_FOREX_PRACTICE',
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    },
    fundingHistoryPreview: accounting()
      .listFunding(accountId)
      .slice(0, 8)
      .map((tx) => {
        const row = publicLedgerRow(tx);
        return row;
      }),
    financialSnapshot: {
      currency: view.currency,
      ledgerBalance: view.ledgerBalance,
      availableBalance: view.availableBalance,
      equity: view.equity,
      usedMargin: view.usedMargin,
      freeMargin: view.freeMargin,
      marginLevel: view.marginLevel,
      unrealizedPnl: view.unrealizedPnl,
      realizedPnl: view.realizedPnl,
      calculationStatus: view.calculationStatus,
      timestamp: view.timestamp,
    },
    riskSnapshot: {
      state: riskStatus.state,
      reason: riskStatus.reason,
      liquidationLock: riskStatus.liquidationLock,
      margin: riskStatus.margin,
      exposure: riskStatus.exposure,
    },
    activitySummary: {
      openPositions: openPositions.length,
      pendingOrders: pendingOrders.length,
    },
    preview: {
      openPositions: openPositions.slice(0, PREVIEW_LIMIT),
      recentOrders,
      recentFills: fills,
    },
  };
}
