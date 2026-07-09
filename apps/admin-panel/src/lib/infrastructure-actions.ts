/** Infrastructure control action keys (POST /admin/monitoring/actions). */
export type InfrastructureAction =
  | 'restart_worker'
  | 'flush_queue'
  | 'reset_circuit_breaker'
  | 'restart_liquidity_bot'
  | 'restart_settlement_worker'
  | 'restart_matching_engine'
  | 'restart_websocket_service';
