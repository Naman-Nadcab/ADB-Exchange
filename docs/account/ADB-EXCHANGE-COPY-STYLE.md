# ADB Exchange copy style

Customer-facing and admin-facing product language uses these rules. They do not change supported locales, and they do not add legal, licensing, or regulatory claims.

## Voice

Professional, trustworthy, modern, concise, and financially precise. Confident without promotion. No slang, no developer notes, and no hype.

## Name

The customer-facing product name is **ADB Exchange**.

Do not use Finelite, Metherium, FDA Exchange, EDA Exchange, FDM, Fintech Digital Market, or a bare "Exchange" as the product name.

Generic financial words stay as they are. "Exchange rate" is not a brand. Internal type codes such as `INTERNAL_FDM`, cookie names, package identifiers, and repository history are not product copy.

## Products

Crypto and Forex keep separate words because their accounting is different.

Crypto: funding balance, spot balance, available balance, locked balance, deposit, withdrawal, network fee.

Forex: equity, margin, free margin, unrealized P&L, positions. Do not call Forex equity a wallet balance.

Shared words: order, fee, identity, KYC, sign-in wallet, deposit address.

The sign-in wallet proves control of an address. It is not a deposit address. Signing a sign-in message does not send funds.

## Errors

State the failure and the next step. Do not describe success when a request failed.

Prefer "Unable to load markets. Please try again." over "Failed to load markets. Retry." or instructions to start Postgres, run migrations, or set environment variables.

"Not configured" is used when an account detail has not been set. "Coming soon" is only for a capability that is actually not available.

## Do not claim

Do not write "fully regulated", "bank-grade security", "guaranteed", "risk-free", or "instant profits" unless a verified source in this repository supports that exact claim. This pass found no such source. Do not invent a legal entity, registration number, license, regulator, or office address.
