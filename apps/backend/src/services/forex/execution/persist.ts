import { db } from '../../../lib/database.js';
import { forexIsoTimestamp, forexStr, fxq, type ForexQueryable } from '../durability/tx.js';
import type { ForexExecutionAttempt, ForexExecutionEvent, ForexExecutionRecord, ForexFill } from './models.js';
import type { ForexExecutionRequest } from './request.js';
import type { ForexExecReason, ForexExecutionState } from './states.js';

export async function persistExecution(record: ForexExecutionRecord, client?: ForexQueryable): Promise<void> {
  const q = fxq(client);
  await q.query(
    `INSERT INTO forex_executions (
       execution_id, client_exec_id, fingerprint, account_id, symbol, side, volume, order_type,
       requested_price, max_slippage, max_deviation, status, selected_provider, routing_reason,
       snapshot_status, expected_price, execution_price, filled_volume, remaining_volume,
       failure_reason, request_json, source
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
     )
     ON CONFLICT (execution_id) DO UPDATE SET
       status = EXCLUDED.status,
       selected_provider = EXCLUDED.selected_provider,
       routing_reason = EXCLUDED.routing_reason,
       snapshot_status = EXCLUDED.snapshot_status,
       expected_price = EXCLUDED.expected_price,
       execution_price = EXCLUDED.execution_price,
       filled_volume = EXCLUDED.filled_volume,
       remaining_volume = EXCLUDED.remaining_volume,
       failure_reason = EXCLUDED.failure_reason,
       updated_at = CURRENT_TIMESTAMP`,
    [
      record.executionId,
      record.clientExecId,
      record.fingerprint,
      record.request.accountId ?? null,
      record.request.symbol,
      record.request.side,
      record.requestedVolume,
      record.request.orderType,
      record.request.requestedPrice ?? null,
      record.request.maxSlippage ?? null,
      record.request.maxDeviation ?? null,
      record.status,
      record.selectedProvider,
      record.routingReason,
      record.snapshotStatus,
      record.expectedPrice,
      record.executionPrice,
      record.filledVolume,
      record.remainingVolume,
      record.failureReason,
      JSON.stringify(record.request),
      record.source,
    ]
  );

  for (const attempt of record.attempts) {
    await q.query(
      `INSERT INTO forex_execution_attempts (
         execution_id, attempt_no, provider, status, venue_exec_id, reject_reason, submitted_at, completed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (execution_id, attempt_no) DO UPDATE SET
         status = EXCLUDED.status,
         venue_exec_id = EXCLUDED.venue_exec_id,
         reject_reason = EXCLUDED.reject_reason,
         completed_at = EXCLUDED.completed_at`,
      [
        record.executionId,
        attempt.attemptNo,
        attempt.provider,
        attempt.status,
        attempt.venueExecId,
        attempt.rejectReason,
        attempt.submittedAt,
        attempt.completedAt,
      ]
    );
  }
}

export async function persistFill(fill: ForexFill, client?: ForexQueryable): Promise<void> {
  await fxq(client).query(
    `INSERT INTO forex_fills (
       fill_id, execution_id, client_exec_id, venue_exec_id, provider, symbol, side,
       price, volume, fill_timestamp, liquidity_source
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (fill_id) DO NOTHING`,
    [
      fill.fillId,
      fill.executionId,
      fill.clientExecId,
      fill.venueExecId,
      fill.provider,
      fill.symbol,
      fill.side,
      fill.price,
      fill.volume,
      forexIsoTimestamp(fill.timestamp, new Date().toISOString()),
      fill.liquiditySource === 'BROKER' ? 'BROKER' : 'MOCK',
    ]
  );
}

export async function persistEvent(event: ForexExecutionEvent, client?: ForexQueryable): Promise<void> {
  await fxq(client).query(
    `INSERT INTO forex_execution_events (
       event_id, execution_id, client_exec_id, event_type, provider, reason, metadata, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (event_id) DO NOTHING`,
    [
      event.eventId,
      event.executionId,
      event.clientExecId,
      event.eventType,
      event.provider ?? null,
      event.reason ?? null,
      JSON.stringify(event.metadata ?? {}),
      forexIsoTimestamp(event.timestamp, new Date().toISOString()),
    ]
  );
}

function str(v: unknown): string {
  return forexStr(v);
}

export async function loadAllExecutions(): Promise<ForexExecutionRecord[]> {
  const execRes = await db.query(`SELECT * FROM forex_executions ORDER BY created_at DESC`);
  const execRows = execRes.rows as Record<string, unknown>[];
  if (execRows.length === 0) return [];

  const executionIds = execRows.map((r) => str(r.execution_id));
  const [attemptsRes, fillsRes, eventsRes] = await Promise.all([
    db.query(`SELECT * FROM forex_execution_attempts WHERE execution_id = ANY($1::uuid[]) ORDER BY execution_id, attempt_no`, [
      executionIds,
    ]),
    db.query(`SELECT * FROM forex_fills WHERE execution_id = ANY($1::uuid[]) ORDER BY execution_id, created_at`, [
      executionIds,
    ]),
    db.query(`SELECT * FROM forex_execution_events WHERE execution_id = ANY($1::uuid[]) ORDER BY execution_id, created_at`, [
      executionIds,
    ]),
  ]);

  const attemptsByExec = new Map<string, ForexExecutionAttempt[]>();
  for (const a of attemptsRes.rows as Record<string, unknown>[]) {
    const eid = str(a.execution_id);
    const list = attemptsByExec.get(eid) ?? [];
    list.push({
      attemptNo: Number(a.attempt_no),
      provider: str(a.provider),
      status: a.status as ForexExecutionAttempt['status'],
      venueExecId: a.venue_exec_id == null ? null : str(a.venue_exec_id),
      rejectReason: a.reject_reason == null ? null : str(a.reject_reason),
      submittedAt: str(a.submitted_at),
      completedAt: a.completed_at == null ? null : str(a.completed_at),
    });
    attemptsByExec.set(eid, list);
  }

  const fillsByExec = new Map<string, ForexFill[]>();
  for (const f of fillsRes.rows as Record<string, unknown>[]) {
    const eid = str(f.execution_id);
    const list = fillsByExec.get(eid) ?? [];
    list.push({
      fillId: str(f.fill_id),
      executionId: str(f.execution_id),
      clientExecId: str(f.client_exec_id),
      venueExecId: f.venue_exec_id == null ? null : str(f.venue_exec_id),
      provider: str(f.provider),
      symbol: str(f.symbol),
      side: f.side === 'sell' ? 'sell' : 'buy',
      price: str(f.price),
      volume: str(f.volume),
      timestamp: str(f.fill_timestamp),
      liquiditySource: f.liquidity_source === 'BROKER' ? 'BROKER' : 'MOCK',
    });
    fillsByExec.set(eid, list);
  }

  const eventsByExec = new Map<string, ForexExecutionEvent[]>();
  for (const e of eventsRes.rows as Record<string, unknown>[]) {
    const eid = str(e.execution_id);
    const list = eventsByExec.get(eid) ?? [];
    list.push({
      eventId: str(e.event_id),
      executionId: str(e.execution_id),
      clientExecId: str(e.client_exec_id),
      timestamp: str(e.created_at),
      eventType: e.event_type as ForexExecutionEvent['eventType'],
      provider: e.provider == null ? undefined : str(e.provider),
      reason: e.reason == null ? undefined : str(e.reason),
      metadata: (e.metadata as Record<string, unknown> | undefined) ?? {},
    });
    eventsByExec.set(eid, list);
  }

  return execRows.map((row) => {
    const executionId = str(row.execution_id);
    const requestJson = (typeof row.request_json === 'object' && row.request_json != null
      ? row.request_json
      : {}) as Partial<ForexExecutionRequest>;
    const request: ForexExecutionRequest = {
      clientExecId: str(row.client_exec_id),
      symbol: str(row.symbol),
      side: row.side === 'sell' ? 'sell' : 'buy',
      volume: str(row.volume),
      orderType: row.order_type === 'limit' ? 'limit' : 'market',
      requestedPrice: row.requested_price != null ? str(row.requested_price) : undefined,
      maxSlippage: row.max_slippage != null ? str(row.max_slippage) : undefined,
      maxDeviation: row.max_deviation != null ? str(row.max_deviation) : undefined,
      accountId: row.account_id != null ? str(row.account_id) : undefined,
      timestamp: requestJson.timestamp ?? str(row.created_at),
    };
    return {
      executionId,
      clientExecId: str(row.client_exec_id),
      fingerprint: str(row.fingerprint),
      request,
      status: row.status as ForexExecutionState,
      selectedProvider: row.selected_provider == null ? null : str(row.selected_provider),
      routingReason: row.routing_reason == null ? null : str(row.routing_reason),
      snapshotStatus: row.snapshot_status == null ? null : str(row.snapshot_status),
      expectedPrice: row.expected_price == null ? null : str(row.expected_price),
      executionPrice: row.execution_price == null ? null : str(row.execution_price),
      requestedVolume: str(row.volume),
      filledVolume: str(row.filled_volume),
      remainingVolume: str(row.remaining_volume),
      failureReason: row.failure_reason == null ? null : (str(row.failure_reason) as ForexExecReason),
      source: row.source === 'LIVE' ? 'LIVE' : 'SIMULATED',
      attempts: attemptsByExec.get(executionId) ?? [],
      fills: fillsByExec.get(executionId) ?? [],
      events: eventsByExec.get(executionId) ?? [],
      createdAt: str(row.created_at),
      updatedAt: str(row.updated_at),
    };
  });
}

export async function loadExecutionByClient(clientExecId: string): Promise<ForexExecutionRecord | null> {
  const execRes = await db.query(
    `SELECT * FROM forex_executions WHERE client_exec_id = $1 LIMIT 1`,
    [clientExecId]
  );
  const row = execRes.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const executionId = str(row.execution_id);
  const [attemptsRes, fillsRes, eventsRes] = await Promise.all([
    db.query(`SELECT * FROM forex_execution_attempts WHERE execution_id = $1 ORDER BY attempt_no`, [executionId]),
    db.query(`SELECT * FROM forex_fills WHERE execution_id = $1 ORDER BY created_at`, [executionId]),
    db.query(`SELECT * FROM forex_execution_events WHERE execution_id = $1 ORDER BY created_at`, [executionId]),
  ]);

  const requestJson = (typeof row.request_json === 'object' && row.request_json != null
    ? row.request_json
    : {}) as Partial<ForexExecutionRequest>;
  const request: ForexExecutionRequest = {
    clientExecId: str(row.client_exec_id),
    symbol: str(row.symbol),
    side: row.side === 'sell' ? 'sell' : 'buy',
    volume: str(row.volume),
    orderType: row.order_type === 'limit' ? 'limit' : 'market',
    requestedPrice: row.requested_price != null ? str(row.requested_price) : undefined,
    maxSlippage: row.max_slippage != null ? str(row.max_slippage) : undefined,
    maxDeviation: row.max_deviation != null ? str(row.max_deviation) : undefined,
    accountId: row.account_id != null ? str(row.account_id) : undefined,
    timestamp: requestJson.timestamp ?? str(row.created_at),
  };

  const attempts: ForexExecutionAttempt[] = (attemptsRes.rows as Record<string, unknown>[]).map((a) => ({
    attemptNo: Number(a.attempt_no),
    provider: str(a.provider),
    status: a.status as ForexExecutionAttempt['status'],
    venueExecId: a.venue_exec_id == null ? null : str(a.venue_exec_id),
    rejectReason: a.reject_reason == null ? null : str(a.reject_reason),
    submittedAt: str(a.submitted_at),
    completedAt: a.completed_at == null ? null : str(a.completed_at),
  }));

  const fills: ForexFill[] = (fillsRes.rows as Record<string, unknown>[]).map((f) => ({
    fillId: str(f.fill_id),
    executionId: str(f.execution_id),
    clientExecId: str(f.client_exec_id),
    venueExecId: f.venue_exec_id == null ? null : str(f.venue_exec_id),
    provider: str(f.provider),
    symbol: str(f.symbol),
    side: f.side === 'sell' ? 'sell' : 'buy',
    price: str(f.price),
    volume: str(f.volume),
    timestamp: str(f.fill_timestamp),
    liquiditySource: f.liquidity_source === 'BROKER' ? 'BROKER' : 'MOCK',
  }));

  const events: ForexExecutionEvent[] = (eventsRes.rows as Record<string, unknown>[]).map((e) => ({
    eventId: str(e.event_id),
    executionId: str(e.execution_id),
    clientExecId: str(e.client_exec_id),
    timestamp: str(e.created_at),
    eventType: e.event_type as ForexExecutionEvent['eventType'],
    provider: e.provider == null ? undefined : str(e.provider),
    reason: e.reason == null ? undefined : str(e.reason),
    metadata: (e.metadata as Record<string, unknown> | undefined) ?? {},
  }));

  return {
    executionId,
    clientExecId: str(row.client_exec_id),
    fingerprint: str(row.fingerprint),
    request,
    status: row.status as ForexExecutionState,
    selectedProvider: row.selected_provider == null ? null : str(row.selected_provider),
    routingReason: row.routing_reason == null ? null : str(row.routing_reason),
    snapshotStatus: row.snapshot_status == null ? null : str(row.snapshot_status),
    expectedPrice: row.expected_price == null ? null : str(row.expected_price),
    executionPrice: row.execution_price == null ? null : str(row.execution_price),
    requestedVolume: str(row.volume),
    filledVolume: str(row.filled_volume),
    remainingVolume: str(row.remaining_volume),
    failureReason: row.failure_reason == null ? null : (str(row.failure_reason) as ForexExecReason),
    source: row.source === 'LIVE' ? 'LIVE' : 'SIMULATED',
    attempts,
    fills,
    events,
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}
