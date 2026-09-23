# Interaction coverage (i18n)

| Flow | Locales tested | Method | Result |
| --- | --- | --- | --- |
| Wallet convert DOM | zh-CN, id-ID | Playwright authenticated | PASS (prior BUILD_ID) |
| Wallet history DOM | zh-CN, id-ID | Playwright authenticated | PASS (prior BUILD_ID) |
| Wallet funding DOM | zh-CN, id-ID | Playwright (single-login loop) | PASS |
| Wallet pnl DOM | zh-CN, id-ID | Playwright (single-login loop) | PASS |
| Language switch + refresh + first paint | en → zh-CN → id-ID | `i18n-locale-behavior.spec.ts` | partial |
| Modal/toast/notification crawl | all | manual + spot checks | incomplete |
| Form validation errors | all | incomplete | incomplete |

**Rule:** A route is not certified until interaction-generated UI (modals, toasts, validation) is verified in the selected locale.
