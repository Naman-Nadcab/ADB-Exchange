# STEP 23 — Free dependency discovery and staging readiness

Production was not deployed, restarted, migrated, or reconfigured. No withdrawal was broadcast. No live Forex order was sent. No secret was committed.

FREE SANCTIONS COVERAGE = PARTIAL
COMMERCIAL SCREENING = STILL REQUIRED
LIVE SCREENING PROVIDER = NOT VERIFIED
PRODUCTION WITHDRAWAL CERTIFICATION = NOT COMPLETE

`official_public_lists` is an exact OFAC digital-currency address check. It is not Chainalysis, TRM, or Elliptic.

## A. Dependency inventory

See `docs/account/STEP-23-DEPENDENCY-INVENTORY.md`.

## B. Free options evaluated

- OFAC SDN files, including digital currency addresses. Selected for a local exact-match provider.
- Chainalysis public sanctions API. Already in the code. Still needs an API key. Not called.
- UN consolidated list XML. Public download. Not selected.
- OpenSanctions dataset. Not selected.
- Public chain RPCs. Not hardcoded.
- SMTP as a standards relay. Already supported. No mail server installed.
- VAPID web push. Already in the repo.
- CoinGecko and Binance public market data. Left inactive.
- Wallet extensions. Free to install. Not present here.
- GHCR via `GITHUB_TOKEN`. Workflow exists. This token could not push.

## C. Open-source options evaluated

- First-party OFAC parser. No new npm package.
- OpenSanctions matcher. Not used, because the data license is the restriction.
- Chain clients for a self-hosted RPC. Not installed.
- Expo / Android command-line tools. Java is present. The SDK was not installed.

## D. Self-hosted options evaluated

- Local sanctions snapshot with checksum and rollback. Implemented.
- Self-hosted chain node. Not implemented.
- Self-hosted SMTP. Not installed on this host.
- Self-hosted Forex matching. The existing mock venue stays the isolated path. The live LP guard stays.

## E. License and commercial-use findings

OFAC list data is a work of the United States government (17 U.S.C. § 105). OFAC's advanced-XML FAQ says anyone may use those files. FAQ 594 says the downloadable files can be used to screen listed digital currency addresses. OFAC also says those address listings are not likely to be exhaustive.

The UN consolidated list is published for implementation. This step did not find an explicit commercial-use grant, so the file was not ingested.

OpenSanctions software being open source does not make the OpenSanctions dataset free for this product. It was not downloaded.

No new package was added. The image build still reports the existing npm audit set (21 vulnerabilities in the unchanged production dependency tree). Nothing new was introduced to clear or accept those.

## F. What was installed

Provider id `official_public_lists`.

- Parser for OFAC `idNumber` and advanced `VersionDetail` digital currency addresses.
- Snapshot directory from `SANCTIONS_PUBLIC_LISTS_DIR` (default `data/official-public-lists`).
- Manifest with source, URL, version, download time, source SHA-256, address SHA-256, and count.
- Atomic replace: a bad snapshot does not become current. The previous current snapshot remains.
- Fail closed on missing, empty, partial, corrupt, checksum mismatch, download error, timeout, and age over `SANCTIONS_PUBLIC_LISTS_MAX_AGE_HOURS` (default 48).
- An empty dataset never returns CLEAR.
- Customer match text remains `Address matches sanctions designation`, so the existing sanctions audit path classifies it as a match.
- `/health` includes `sanctions_public_lists`. The exchange is not marked degraded unless this provider is the selected `SANCTIONS_PROVIDER` and the snapshot is not ready.
- Admin `api_settings` may name this provider without an API key. A keyed active AML row still wins over it.
- The downloader calls only `https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ADVANCED.XML`. Any admin URL is ignored.

`noop`, the Chainalysis public caller, and the generic commercial POST adapter are unchanged.

## G. What was not installed

- OpenSanctions data
- UN list
- A live Chainalysis, TRM, or Elliptic credential
- MetaMask, Phantom, or a fake `window.ethereum`
- Android SDK, emulator, or an generated `android/` tree
- A public RPC hardcoded for production
- An SMTP daemon
- A free Forex broker
- A card-network sandbox
- A GHCR image

## H. Why

A free file that lists exact addresses is useful and legal to screen. It does not see addresses that belong to a sanctioned actor but were never listed. That is the commercial vendor's job. Installing the file as if it were Chainalysis would be a false PASS.

## I. Sanctions provider result

FREE OPTION — LIMITED.

Tests:

- Fixture unit test `OFFICIAL_PUBLIC_LISTS_PASS`: clear, exact match, EVM case match, one-character non-match, base58 case difference, missing address, corrupt update, partial update, empty update, checksum mismatch, stale snapshot, missing dataset, timeout, HTTP 500, and a good refresh.
- In-process gate `STEP23_PUBLIC_LISTS_GATE_PASS` on isolated database `rc20`: with no snapshot the result is unavailable and is not a sanctions match; with a fixture, a known address is a match and a different address is clear. The result JSON does not contain the source XML.
- Isolated release image `sha256:79326a1f73cebaafbcd32f133881a056d95b75400ee8dc0c2d81ee4cbddb136f` still runs `SANCTIONS_PROVIDER=http-gateway`. STEP 22 returned `STEP22_SECURITY_COMPLIANCE_PASS` on that image, including match audit, provider failure, secret redaction, and suspended-session rejection.
- `/health` on that stack reports `sanctions_public_lists.status=missing` and overall `healthy`, because the public-list provider is not the selected provider.

A full OFAC file was not committed. The live treasury download was not required for the fixture proof. Production screening configuration was not switched.

## J. Browser wallet result

NOT VERIFIED.

Chrome in this environment has no MetaMask or Phantom extension. No provider was injected.

## K. Mobile toolchain result

NOT VERIFIED.

Java 21 is installed. `adb`, Android SDK, Gradle, and Xcode are not. The Expo app has no native project directory. Generating one would change the app tree, so it was not done. iOS cannot be built on this Linux host.

## L. RPC result

FREE OPTION — LIMITED.

Public and self-hosted RPCs can feed `chains.rpc_url`. The repo already has an admin provider row, a budget limit for non-critical calls, and a bridge that copies an admin URL into `chains`. No new public endpoint was hardcoded. Production RPC settings were not read for secrets and were not written.

## M. GHCR result

NOT VERIFIED.

The workflow already uses `GITHUB_TOKEN` and a SHA tag. It also tags `:latest`. This session did not push either tag. The token did not present package scopes. The workflow file was left unchanged so a deploy that still pulls `:latest` is not altered without a verified push.

## N. Forex provider result

PAID PROVIDER REQUIRED.

The live broker adapter and `LIVE_LP_FORBIDDEN` guard remain. No free quote API was wired in as an LP. Isolated Forex stays mock.

## O. Card and payment result

NOT APPLICABLE.

There is no card-network adapter to replace. Fiat withdrawal remains an internal bank-account request, not a card authorization.

## P. Security review

- TLS: the only download URL is the official OFAC HTTPS endpoint.
- Timeout: refresh aborts at 60 seconds by default. Tests cover a 20 millisecond timeout.
- Fail closed: transport errors and bad snapshots do not clear a withdrawal.
- Secrets: this provider has no API secret. Commercial secrets stay redacted.
- SSRF: the refresh function does not fetch an admin-supplied URL.
- Logging: match reason is the existing designation sentence. Raw SDN identity text is not returned.
- Schema: a snapshot must end with `</Sanctions>`, `</sdnList>`, or the fixture root, and must contain at least one address.
- Dependencies: no package was added, so no new license or advisory was accepted.
- Stale data cannot clear. It returns `Sanctions service unavailable`.

## Q. Regression results

On image `sha256:79326a1f73cebaafbcd32f133881a056d95b75400ee8dc0c2d81ee4cbddb136f` through `http://127.0.0.1:18080`:

`STEP22_SECURITY_COMPLIANCE_PASS`

That run covers KYC before sanctions, CLEAR, MATCH audit, provider 500, timeout, malformed body, cross-user audit isolation, secret redaction, stale suspended session, refresh, new login, Spot, P2P, Forex, transfer, fiat withdrawal, and survival across a backend restart.

Backend `tsc` passed inside the image build.

Wallet-auth, IDOR, Spot, Rust, P2P, and Forex suites beyond that script were not all re-executed. Their source was not changed. The isolated matching-engine image was not rebuilt.

REAL BROWSER WALLET = NOT VERIFIED.
NATIVE MOBILE = NOT VERIFIED.
LIVE FOREX BROKER = NOT VERIFIED.
GHCR = NOT VERIFIED.

## R. Production safety

READ ONLY on `169.58.39.2` `/opt/adb-exchange`.

- HEAD `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`
- working tree line count 0
- `.env` mtime `2026-10-01 13:25:40.767512480 +0200`, size 9998
- containers `Up 2 days (healthy)`
- no restart from this step

Earlier in STEP 22 the same host had database `exchange`, no wallet cutover row, no Forex KYC row, and no sanctions provider write. This step did not open a write connection.

## S. Remaining external dependencies

| Dependency | Label |
| --- | --- |
| OFAC exact address list | FREE OPTION — LIMITED |
| Chainalysis / TRM / Elliptic | PAID PROVIDER REQUIRED |
| UN consolidated list | NOT VERIFIED |
| OpenSanctions dataset | PAID PROVIDER REQUIRED |
| Travel Rule vendor | PAID PROVIDER REQUIRED |
| KYC vendor | PAID PROVIDER REQUIRED |
| Browser wallet extension | NOT VERIFIED |
| WalletConnect project | NOT VERIFIED |
| Chain RPC of the operator's choice | FREE OPTION — LIMITED |
| SMTP email | SAFE FREE OPTION |
| SMS | PAID PROVIDER REQUIRED |
| Web Push / VAPID | SAFE FREE OPTION |
| Live Forex LP | PAID PROVIDER REQUIRED |
| Card network | NOT APPLICABLE |
| External custody vendor | PAID PROVIDER REQUIRED |
| GHCR push from this session | NOT VERIFIED |
| Native Android / iOS | NOT VERIFIED |

Before SHA `c55c3dac8e2ddbecec8de81f1c6b39d321ec2546`. Implementation SHA `63002b241f2e6a2c83a13e2160dc283c11f4399f`. Isolated backend image `sha256:79326a1f73cebaafbcd32f133881a056d95b75400ee8dc0c2d81ee4cbddb136f`.
