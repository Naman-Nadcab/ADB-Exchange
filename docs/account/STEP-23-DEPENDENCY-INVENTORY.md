# STEP 23 — External dependency inventory

Recorded on branch `cursor/local-kms-provider-fb5f` before the public-list provider was selected. Production was not changed. No paid vendor was removed.

Labels used later in `STEP-23-FREE-DEPENDENCY-DISCOVERY-AND-STAGING-READINESS.md`: IMPLEMENTED, SAFE FREE OPTION, FREE OPTION — LIMITED, PAID PROVIDER REQUIRED, NOT VERIFIED, NOT APPLICABLE.

## Sanctions / AML

DEPENDENCY: Chainalysis, TRM Labs, Elliptic (seeded `api_settings` category `aml`, all inactive)
CURRENT IMPLEMENTATION: `checkSanctions` calls Chainalysis public when the provider or URL matches, otherwise a generic POST `{address,name,amount,asset,userId}` with `X-API-Key`. `noop` is fail-closed in production.
WHY IT EXISTS: Withdrawal screening before any ledger debit.
REQUIRED FOR PRODUCTION? Yes for production-grade screening. OFAC says its own digital-currency address list is not exhaustive.
CURRENT STATUS: LIVE SCREENING PROVIDER = NOT VERIFIED. Contract tests use an isolated HTTP stub.
FREE OPTION? Chainalysis has a public sanctions API that still requires an API key. It was already implemented and was not re-certified live.
OPEN-SOURCE OPTION? No vendor-equivalent open-source clustering engine was adopted.
SELF-HOSTED OPTION? The new `official_public_lists` provider screens a local snapshot. It does not replace these vendors.
FREE-TIER OPTION? Not used. No sandbox key was present.
LICENSE: Vendor terms. Not accepted here.
COMMERCIAL USE ALLOWED? Only under each vendor contract.
LIMITATIONS: Without a key the production path stays fail-closed.
SECURITY CONCERNS: Secrets stay in `api_secret` and are redacted on GET/POST/PUT.
RECOMMENDATION: Keep the adapters. Do not point production at a free list and call it equivalent.
IMPLEMENT NOW? NO for a live vendor. YES for a separate partial public-list provider.

DEPENDENCY: OFAC SDN digital currency addresses
CURRENT IMPLEMENTATION: New provider `official_public_lists`.
WHY IT EXISTS: Official public identifiers OFAC itself says can be screened from its list files.
REQUIRED FOR PRODUCTION? Not sufficient alone.
CURRENT STATUS: Implemented and fixture-tested. Not the isolated stack's active provider (`http-gateway` remains for the STEP 22 contract).
FREE OPTION? Yes. US government work, 17 U.S.C. § 105. OFAC FAQ says anyone may use the advanced XML, and FAQ 594 says the files can be used to screen listed digital currency addresses.
OPEN-SOURCE OPTION? The parser is first-party. No third-party matcher was added.
SELF-HOSTED OPTION? Yes. Snapshot, checksum, and atomic replace are local.
FREE-TIER OPTION? Not applicable. No account.
LICENSE: Data is a US government work. Software written here stays in this repository.
COMMERCIAL USE ALLOWED? OFAC publishes the list so it can be used for compliance screening. Listings are not exhaustive (OFAC FAQ on digital currency addresses).
LIMITATIONS: Exact listed address only. No cluster expansion, no PEP, no Travel Rule name match, no non-US lists.
SECURITY CONCERNS: Downloader allows only `https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ADVANCED.XML`. An empty, partial, corrupt, or stale snapshot fail-closes. Customer reason stays `Address matches sanctions designation`. The SDN name is not stored.
RECOMMENDATION: Use for staging and as an extra exact-address control. Keep a commercial screener for production.
IMPLEMENT NOW? YES, as FREE OPTION — LIMITED.

DEPENDENCY: UN Security Council consolidated list
CURRENT IMPLEMENTATION: None.
WHY IT EXISTS: Name-based UN measures. The published file is mostly names, not crypto addresses.
REQUIRED FOR PRODUCTION? A regulated program may still need it under local law. This repository does not claim a jurisdiction matrix.
CURRENT STATUS: Not installed.
FREE OPTION? The XML is public. No explicit commercial-use license was found on the official list page.
OPEN-SOURCE OPTION? Not adopted.
SELF-HOSTED OPTION? Not installed, because the data license is not an explicit grant.
FREE-TIER OPTION? No account required, and that is not a license.
LICENSE: Not verified as a commercial grant. Not ingested.
COMMERCIAL USE ALLOWED? Not established.
LIMITATIONS: Name list, not wallet-address clustering.
SECURITY CONCERNS: Signed redirect URLs on the download host. Not used.
RECOMMENDATION: Do not vendor the file until counsel confirms the terms.
IMPLEMENT NOW? NO.

DEPENDENCY: OpenSanctions
CURRENT IMPLEMENTATION: None.
WHY IT EXISTS: Often suggested as a free sanctions database.
REQUIRED FOR PRODUCTION? No.
CURRENT STATUS: Not installed.
FREE OPTION? The matching software is often MIT. The dataset license is commercial for for-profit use.
OPEN-SOURCE OPTION? Software only. Data was not used.
SELF-HOSTED OPTION? Not installed.
FREE-TIER OPTION? Not used.
LICENSE: Data license is not a free commercial grant.
COMMERCIAL USE ALLOWED? Not on the bulk dataset without their commercial terms.
LIMITATIONS: Using the MIT matcher with their data would not make the data free.
SECURITY CONCERNS: Would mix a paid data license into a "free" provider.
RECOMMENDATION: Do not use it as a free production dependency.
IMPLEMENT NOW? NO.

DEPENDENCY: Notabene Travel Rule
CURRENT IMPLEMENTATION: Inactive `api_settings` row `travel_rule/notabene`.
WHY IT EXISTS: Travel Rule counterparty data.
REQUIRED FOR PRODUCTION? Where the Travel Rule applies, yes.
CURRENT STATUS: Inactive. Not verified.
FREE OPTION? No equivalent official free Travel Rule network was adopted.
LICENSE: Vendor.
RECOMMENDATION: PAID PROVIDER REQUIRED.
IMPLEMENT NOW? NO.

## Wallet and chain access

DEPENDENCY: Browser wallet (MetaMask / EIP-1193 / EIP-6963, Phantom / Solana Wallet Standard)
CURRENT IMPLEMENTATION: `apps/frontend/src/lib/wallet-auth/browser-connector.ts` discovers injected providers. Server wallet login verifies the signature.
WHY IT EXISTS: Customer sign-in. The sign-in wallet is not the deposit or withdrawal wallet.
REQUIRED FOR PRODUCTION? A real customer browser needs an extension or WalletConnect. The server path is already real.
CURRENT STATUS: REAL BROWSER WALLET = NOT VERIFIED. This environment has no MetaMask or Phantom extension.
FREE OPTION? The wallet apps are free to install. None could be installed from a legitimate store in this session without injecting `window.ethereum`.
OPEN-SOURCE OPTION? The connector is already in the repo. No new wallet framework was added.
SELF-HOSTED OPTION? Not applicable.
LICENSE: Wallet trademarks and extension licenses stay with their publishers.
RECOMMENDATION: Do not fake an injected provider.
IMPLEMENT NOW? NO.

DEPENDENCY: WalletConnect / Reown
CURRENT IMPLEMENTATION: Mobile dependency `@walletconnect/ethereum-provider`. No project id in production env (STEP 16).
WHY IT EXISTS: Mobile and browser wallets that are not injected.
REQUIRED FOR PRODUCTION? Only if that sign-in path is enabled.
CURRENT STATUS: NOT VERIFIED. No project id.
FREE OPTION? The SDK is free. The relay needs a project id. None was available.
RECOMMENDATION: Leave it unwired until a project id exists.
IMPLEMENT NOW? NO.

DEPENDENCY: Chain RPC
CURRENT IMPLEMENTATION: Live reads use `chains.rpc_url`. Admin `node_providers` and `api_settings` category `rpc` can store endpoints. `rpc-budget-manager` rate-limits non-critical reads. Timeouts exist on admin RPC config (`timeout` 30000).
WHY IT EXISTS: Deposits, confirmations, and later broadcasts.
REQUIRED FOR PRODUCTION? Yes.
CURRENT STATUS: Production RPC config was not read or changed. Isolated seed data includes public chain URLs from migrations.
FREE OPTION? Public RPCs exist and are rate-limited. A local node is the self-hosted option.
OPEN-SOURCE OPTION? Chain clients (geth, and others) were not installed.
SELF-HOSTED OPTION? Not installed in this step.
FREE-TIER OPTION? Not newly configured.
LICENSE: Depends on the endpoint operator.
SECURITY CONCERNS: A public RPC can censor, rate-limit, or observe queries. It must not be hardcoded as the production custody path.
RECOMMENDATION: Keep admin-configured URLs. Do not add a new hardcoded public endpoint.
IMPLEMENT NOW? NO.

DEPENDENCY: Blockchain indexer
CURRENT IMPLEMENTATION: `rc20-indexer` image, separate from this change.
WHY IT EXISTS: Deposit detection.
REQUIRED FOR PRODUCTION? Yes for on-chain deposits.
CURRENT STATUS: Isolated indexer was already healthy. Not modified.
RECOMMENDATION: NOT APPLICABLE to a new free package.
IMPLEMENT NOW? NO.

## Identity, messages, and payments

DEPENDENCY: KYC vendors (HyperVerge, Sumsub)
CURRENT IMPLEMENTATION: Inactive `api_settings` category `kyc`. Internal KYC rows still gate withdrawals.
WHY IT EXISTS: Identity verification.
REQUIRED FOR PRODUCTION? A real identity vendor is required if the product relies on document KYC. The internal approved-KYC flag is not a vendor.
CURRENT STATUS: Vendor submission NOT VERIFIED.
FREE OPTION? No official free identity-document vendor was suitable.
RECOMMENDATION: PAID PROVIDER REQUIRED.
IMPLEMENT NOW? NO.

DEPENDENCY: Email (SMTP, Resend, SendGrid)
CURRENT IMPLEMENTATION: `api_settings` category `email`. SMTP is the default inactive row. `smtpFromResolved` already builds a config from host, user, and secret.
WHY IT EXISTS: OTP and account mail.
REQUIRED FOR PRODUCTION? Yes for email delivery.
CURRENT STATUS: Not exercised live.
FREE OPTION? Any standards SMTP relay, including a company-operated one.
SELF-HOSTED OPTION? Possible. A mail server was not installed on this host.
RECOMMENDATION: Keep the existing SMTP provider. Do not install Postfix on the app host.
IMPLEMENT NOW? NO.

DEPENDENCY: SMS (Fast2SMS, Twilio, MSG91)
CURRENT IMPLEMENTATION: Inactive `api_settings` category `sms`.
WHY IT EXISTS: Phone OTP.
REQUIRED FOR PRODUCTION? Only if SMS OTP is enabled.
CURRENT STATUS: NOT VERIFIED.
FREE OPTION? No durable free commercial SMS route was adopted. Deliverability and abuse risk are high.
RECOMMENDATION: PAID PROVIDER REQUIRED if SMS is enabled.
IMPLEMENT NOW? NO.

DEPENDENCY: Web Push / VAPID
CURRENT IMPLEMENTATION: `web-push` is already a dependency. Admin can generate a VAPID keypair. The key is not auto-saved.
WHY IT EXISTS: Browser push.
REQUIRED FOR PRODUCTION? No.
CURRENT STATUS: Code present. Not newly configured.
FREE OPTION? VAPID itself is an open standard. Push delivery still uses the browser vendor.
LICENSE: Existing package. No new dependency.
RECOMMENDATION: SAFE FREE OPTION already in the tree. Not reconfigured.
IMPLEMENT NOW? NO.

DEPENDENCY: OAuth (Google, Apple, Telegram)
CURRENT IMPLEMENTATION: Inactive `social_login` rows and auth routes.
WHY IT EXISTS: Optional sign-in.
REQUIRED FOR PRODUCTION? No. Wallet sign-in is the account path under test.
CURRENT STATUS: NOT VERIFIED.
FREE OPTION? Provider apps are free to create and still need each vendor's client id.
RECOMMENDATION: Do not invent client credentials.
IMPLEMENT NOW? NO.

DEPENDENCY: Card networks / Mastercard
CURRENT IMPLEMENTATION: No card-authorization or settlement adapter. "stripe" in the admin UI is a visual border, not a payment processor.
WHY IT EXISTS: Not present.
REQUIRED FOR PRODUCTION? Not for the current crypto withdrawal and bank-fiat withdrawal paths.
CURRENT STATUS: NOT APPLICABLE.
RECOMMENDATION: Do not add a fake card authorizer. A future card program needs the network's own sandbox.
IMPLEMENT NOW? NO.

DEPENDENCY: Custody vendors (Fireblocks, BitGo)
CURRENT IMPLEMENTATION: Inactive `api_settings` category `custody`. Withdrawal signing in the isolated tests uses a non-key ciphertext and does not broadcast.
WHY IT EXISTS: Optional external custody.
REQUIRED FOR PRODUCTION? The current hot-wallet path is separate. Replacing it was out of scope.
CURRENT STATUS: NOT VERIFIED as a vendor integration.
RECOMMENDATION: PAID PROVIDER REQUIRED if an external custodian is selected. Do not swap in a random free custody API.
IMPLEMENT NOW? NO.

## Market data and Forex

DEPENDENCY: Live Forex broker / LP
CURRENT IMPLEMENTATION: Forex execution throws `LIVE_LP_FORBIDDEN` unless the live adapter is explicitly enabled. Isolated certification uses the mock venue.
WHY IT EXISTS: Real FX execution and pricing.
REQUIRED FOR PRODUCTION? Yes for live Forex.
CURRENT STATUS: LIVE FOREX BROKER = NOT VERIFIED.
FREE OPTION? Delayed public FX quotes exist. They are not an LP and cannot accept orders.
RECOMMENDATION: PAID PROVIDER REQUIRED for live execution. Do not add a free quote feed and call it a broker.
IMPLEMENT NOW? NO.

DEPENDENCY: CoinGecko / Binance OHLCV
CURRENT IMPLEMENTATION: Inactive `api_settings` rows `market_data/coingecko` and `chart/binance`.
WHY IT EXISTS: Display prices and candles.
REQUIRED FOR PRODUCTION? Display only. Not custody.
CURRENT STATUS: NOT VERIFIED live.
FREE OPTION? Both publish free tiers with rate limits and their own terms.
RECOMMENDATION: FREE OPTION — LIMITED for display. Not installed or switched on.
IMPLEMENT NOW? NO.

## Operations

DEPENDENCY: GHCR
CURRENT IMPLEMENTATION: `.github/workflows/production.yml` logs in with `GITHUB_TOKEN`, tags `:${{ github.sha }}` and `:latest`, and can deploy on `main`.
WHY IT EXISTS: Image delivery.
REQUIRED FOR PRODUCTION? The current production host was not deployed from this branch.
CURRENT STATUS: GHCR = NOT VERIFIED. This session's token did not present package scopes. No image was pushed. `latest` was not published.
FREE OPTION? GHCR is included with GitHub. The workflow already uses the native token.
RECOMMENDATION: Keep SHA tags. Do not push from this branch.
IMPLEMENT NOW? NO.

DEPENDENCY: Native mobile toolchain
CURRENT IMPLEMENTATION: Expo app under `apps/mobile`. No `android/` or `ios/` directory.
WHY IT EXISTS: Customer mobile app.
REQUIRED FOR PRODUCTION? Not for the web/API certification.
CURRENT STATUS: Java 21 is present. `adb`, `sdkmanager`, Gradle, and Xcode are not. `/dev/kvm` exists. No official SDK was installed, because a native build would require generating an Android project.
RECOMMENDATION: NOT VERIFIED. Do not treat a JS bundle as a device build.
IMPLEMENT NOW? NO.

DEPENDENCY: Monitoring (Sentry, Datadog), analytics, support, AI, captcha, object storage
CURRENT IMPLEMENTATION: Inactive seeded `api_settings` rows.
WHY IT EXISTS: Optional product integrations.
REQUIRED FOR PRODUCTION? No for this certification.
CURRENT STATUS: Not selected.
RECOMMENDATION: Leave them inactive. No free substitute was installed.
IMPLEMENT NOW? NO.
