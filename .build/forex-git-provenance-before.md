# Forex git provenance (before gap-closure implementation)

- **Branch:** `release/exchange-production-baseline`
- **Local HEAD:** `397aebe9cc5a8eef6c4fc612b6a34a9b983940f9`
- **origin/release/exchange-production-baseline:** `397aebe9cc5a8eef6c4fc612b6a34a9b983940f9` (**equal**)
- **merge-base(local, origin tracking):** `397aebe9…` (same)

## Divergence note

`origin/main` at `af55da7765…` is a **different branch** (production packaging). It is **not** ahead of the Forex release baseline branch. No reconciliation merge required before Forex work.

## Commits on Forex baseline (recent)

- `397aebe` — live nginx multi-account cert + switcher click fix
- `b214258` — certification docs
- `dc6f7e7` — multi-account feature

## Worktree

Large unrelated dirty tree (admin, spot index, etc.). Implementation commits must include **Forex-only** paths.
