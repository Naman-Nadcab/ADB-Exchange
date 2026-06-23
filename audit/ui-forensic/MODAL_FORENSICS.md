# MODAL FORENSICS

Static modal inventory + runtime closed-state scan (dialogs not auto-opened).

## Static inventory (19 files)

- `apps/frontend/src/components/TransferModal.tsx`
- `apps/frontend/src/components/ui/alert-dialog.tsx`
- `apps/frontend/src/components/ui/dialog.tsx`
- `apps/admin-panel/src/components/admin-v2/AlertDrawer.tsx`
- `apps/admin-panel/src/components/deposits/ManualCreditModal.tsx`
- `apps/admin-panel/src/components/markets/CreatePairModal.tsx`
- `apps/admin-panel/src/components/markets/DeletePairModal.tsx`
- `apps/admin-panel/src/components/markets/EditFeesModal.tsx`
- `apps/admin-panel/src/components/markets/MarketControlModal.tsx`
- `apps/admin-panel/src/components/monitoring/InfrastructureControlModal.tsx`
- `apps/admin-panel/src/components/monitoring/RpcPriorityModal.tsx`
- `apps/admin-panel/src/components/ops/ActionAuthModal.tsx`
- `apps/admin-panel/src/components/risk/AlertActionModal.tsx`
- `apps/admin-panel/src/components/trading/TradingControlModal.tsx`
- `apps/admin-panel/src/components/treasury/SweepActionModal.tsx`
- `apps/admin-panel/src/components/ui/Modal.tsx`
- `apps/admin-panel/src/components/ui/SafeActionModal.tsx`
- `apps/admin-panel/src/components/withdrawals/ApproveWithdrawalModal.tsx`
- `apps/admin-panel/src/components/withdrawals/RejectWithdrawalModal.tsx`

## Runtime dialog selectors on load

| Route | Dialog hints |
|-------|----------------|
| — | none on load |
