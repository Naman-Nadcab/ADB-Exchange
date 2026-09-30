# Forex P0/P1 gap register

- **order-model** (A) → GREEN: side_x_kind + trading-config orderKinds/paths
- **gtd** (A) → GREEN: GTD + expireAt + expireGtdOrders
- **execution-resolver** (A) → GREEN: resolveForexExecutionCapabilities
- **server-alerts-foundation** (A) → YELLOW: DB + CRUD + quote evaluator; push/email gated
- **command-center** (A) → GREEN: Forex ⌘/Ctrl+K on /forex
- **tape-architecture** (E) → BLUE: UI + provider contract; no fake tape
- **dom-architecture** (E) → BLUE: Explicit unavailable + provider hook
- **timeframes-full-mt5** (F) → ORANGE: Registry lists all; only verified TFs customerSupported
- **indicators-full-mt5** (F) → ORANGE: Subset live; registry roadmap
- **drawings-full-mt5** (F) → ORANGE: Existing engine; expansion roadmap
- **live-fills** (D) → YELLOW: MARKET_DEPENDENT
