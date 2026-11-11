# Full-flow QA — 2026-11-11

**PASS: 69 production-browser cases at 1440×900 and 375×812, plus two fresh real browser buys.** Normal screen cases had zero page errors, console errors, failed requests, HTTP errors, horizontal overflow, raw error/undefined/NaN text or remaining loading placeholders. Expected outage cases are labelled separately in the raw audit.

Contract: `kotoba-edfa2b47.testnet`. Demo player: `player.kotoba-edfa2b47.testnet`. Production build + Vite preview: `http://127.0.0.1:5591`. Chrome channel `chrome`, headless, under the shared `withChromeLock`. No styles, colours, fonts, layout or art changed.

## Ordered judge flow and results

Screenshot names below have a `1440-` or `375-` prefix and `.png` suffix, unless stated otherwise. All paths are under the evidence directories below.

| Step | User action and expected result | Result | Screenshot stems / evidence |
| --- | --- | --- | --- |
| 1 | Open `/`; understand the word-market pitch, live totals and recorded settlement. | PASS | `landing` |
| 2 | Read How it settles: desktop follows `/#how`; phone scrolls to the same section in its approved layout. | PASS | `understand` |
| 3 | Follow Open app to `/app`; browse four December markets and live odds. Use Open/Settled/All and desktop Refresh. | PASS | `board`, `filters` |
| 4 | On phone, navigate weeks, choose Today with no scheduled markets, jump back to Dec 9 and open Your call. | PASS | `375-schedule-empty.png`, `375-schedule-jump.png`, `375-event-sheet.png` |
| 5 | Open all four December detail routes; inspect countdowns, odds, expected source and Transcript not published yet. | PASS | `fomc-2026-12-employment`, `fomc-2026-12-inflation`, `fomc-2026-12-recession`, `fomc-2026-12-tariffs` |
| 6 | Open a bet sheet; switch YES/NO, increase/decrease shares and read a real quote. Enter a decimal or an unfunded order; Buy stays disabled. Escape closes the sheet. | PASS | `quote`, `invalid-quantity`, `insufficient-balance` |
| 7 | Connect from You; Meteor opens `wallet.meteorwallet.app/connect/testnet/login`. Its posted login request names `testnet` and the correct contract. Close the popup; test a blocked popup. | PASS | `meteor-popup-closed`, `meteor-popup-blocked`; `meteor-url` audit rows contain the URL and public request fields. |
| 8 | A person signs in and approves through Meteor's own site. | BLOCKED — manual check | Human approval cannot be automated. The QA signer does not claim to test Meteor's approval site. |
| 9 | Run the QA signer test: connect, buy 1 YES through the app, wait for FINAL and successful receipt outcomes. | PASS — real testnet | Fresh hashes below; `qa-signer/receipt-1440.png`, `qa-signer/receipt-375.png`. |
| 10 | Follow See positions to `/you`, verify the new position against final RPC state, then reload. | PASS | 44 → 45 YES on desktop, then 45 → 46 YES on phone. `qa-signer/position-1440.png`, `qa-signer/position-375.png`. |
| 11 | Visit You disconnected, with positions, with no shares, and with a mainnet name; recover by signing out. Follow Open a market to Creators. | PASS | `you-disconnected-state`, `positions-read-only`, `positions-empty`, `mainnet-account-state`, `sign-out`. Empty shares use a public read of `worker.outlayer.testnet`; no key from that account was loaded and no funds moved. |
| 12 | Open `/resolved` and both January details; inspect YES/40 inflation and NO/0 recession. | PASS | `resolved`, `fomc-2026-01-inflation-40`, `fomc-2026-01-recession` |
| 13 | Recheck all three attestation runs; inspect five browser checks per run and the separately labelled recorded Intel-chain check. Navigate 40 inflation hits and copy the transcript hash; recession has zero hits. | PASS | January detail screenshots, `transcript-navigation`; clipboard equals the pinned PDF SHA-256. |
| 14 | Open `/creators`; inspect grouping, source preview, 0.07 NEAR subsidy at b=100 and 1% fee. Check invalid phrase/liquidity, duplicate id and insufficient funds. | PASS | `creators`, `composer-invalid`, `composer-duplicate`, `composer-balance` |
| 15 | Submit creation of a new market. | BLOCKED — low demo balance | The player had 0.0844305124167287 NEAR spendable before the fresh buys; creation needs 0.121 NEAR with prepaid gas. The UI correctly disables it. No other account was drained or funded. |
| 16 | Resolve, challenge, finalize, claim or refund an eligible market. | BLOCKED — no eligible demo action | December markets are still open; January markets are final and the player's winning shares were already claimed. Historical settlement, challenge and payout evidence remains in `deployments/real-run.json`; no new browser settlement/claim PASS is asserted. |
| 17 | Open `/market/fomc-2099-01-nothing`; see a useful empty state and return to the board. | PASS | `unknown-market-state`, `unknown-market` (return) |
| 18 | Simulate both RPCs failing or rate limiting; see mapped messages and recover with Try again against real RPCs. | PASS | `rpc-down`, `rpc-rate-limit`, `rpc-retry` |
| 19 | Simulate OutLayer 404; transcript/verdict remain usable. Retry both panels against the real API and see verified seals. | PASS | `attestation-unavailable`, `attestation-retry` |

Twelve distinct internal links collected from the rendered screens target known routes/anchors. The legacy `scripts/check-web.mjs` now delegates to the locked full audit and uses the repo's Playwright dependency instead of another project's installation. Run instructions are in [TESTING.md](TESTING.md#full-production-walkthrough-2026-11-11): `pnpm test:flow` for production screens and `pnpm test:e2e` for real signatures.

## Fresh transactions and budget

The November 11 full-flow rerun bought one YES share on `fomc-2026-12-employment` at each width. The test checks the actual signer, receiver, method and exact args on-chain; it waits for FINAL before accepting the sheet receipt. Both positions persist after reload. Invalid quantity and insufficient balance sign nothing. The funded key is loaded only in Node from the existing gitignored credential file and injected into page memory for the QA signer; it is never logged, copied or committed.

| Width | Action | Transaction |
| --- | --- | --- |
| 1440 | 1 YES | [D1q1LC1MpNfRmCxfqjqc7Kd7ThQwtbdijvRQVxFDGXVP](https://testnet.nearblocks.io/txns/D1q1LC1MpNfRmCxfqjqc7Kd7ThQwtbdijvRQVxFDGXVP) |
| 375 | 1 YES | [GGjGLLruUVhfLQUkcFA7umphqsWuiVxzNRnN23c5TAh3](https://testnet.nearblocks.io/txns/GGjGLLruUVhfLQUkcFA7umphqsWuiVxzNRnN23c5TAh3) |

Fresh run spend: **0.00263368737922 testnet NEAR**, including gas, below the **0.3 NEAR** cap. Public evidence and before/after balances: [deployments/qa-browser-2026-11-11.json](deployments/qa-browser-2026-11-11.json). That file also preserves the earlier 42 → 44 QA run and two initial harness failures that sent no transactions. Both successful runs together spent **0.00526737475844 testnet NEAR**. The runner reserves conservative prepaid gas for every signed hash and refuses a rerun above its daily cap.

Production exclusion passes even when building with `VITE_QA_SIGNER=1`: no signer module name or injection marker appears in any generated asset. Mainnet account/RPC guards pass. The startup key global is removed after initialization, and no funded key is persisted in localStorage or sessionStorage.

## Fixes and documentation

- **FIXED:** Meteor SDK 1.0.24 logged the generated sign-in key. Commit `ae7ae39` removes that debug statement from source and both JS entry points through a locked pnpm dependency patch. No key contents were copied into the QA evidence. Production build, all 14 web tests and the real popup checks pass after the fix.
- **FIXED:** README Try it no longer says successful buys only used SDK scripts; it distinguishes the passing QA signer browser flow from manual Meteor approval. The submission worksheet now points to the existing 2:57.92 film and upload copy instead of saying video TBD (commit `4233566`).
- Test-harness corrections: validation messages change input accessible names; the approved phone header hides the desktop How it settles link; Meteor's restored-session reader requires a signer object even for reads. The final audit handles these correctly. Read-only fixtures use a fresh unregistered test key, block write RPCs, and never load a funded account's credential. Screenshots wait for visible images to finish loading.

## External limits

The official January PDF, OutLayer site and all three raw attestation URLs returned HTTP 200 in the separate link check. NearBlocks returned HTTP 403 to automation, so its external page rendering is **BLOCKED by the explorer's protection**. The links retain the exact real account/transaction identifiers; the app's transaction results are independently verified through RPC. No explorer rendering PASS is claimed.

The December 9 PDF URL currently returns 404 because the event is in the future. The UI labels it Expected source URL and says Transcript not published yet. This is an expected future feed, not missing historical proof. There is no new transcript or result to show before the event.

## Screenshot and diagnostic paths

Base: `/private/tmp/claude-501/-Volumes-Extreme-SSD-Projects-grokbot/0f121b7c-0081-4ec0-81a9-0ccb4f7f8b48/scratchpad/flow-qa/kotoba/`.

- `full-flow/audit.json`: 69 passing cases, per-step diagnostics, screenshot paths, internal/external links and public Meteor login request fields. Outage cases have `expected_fault: true`; all ordinary cases have zero console/network/page errors, no overflow and no pending placeholders.
- `full-flow/<width>-<stem>.png`: full-page screenshots at 1440 and 375. Separate `*-state.png` captures retain disconnected, unknown-market and mainnet states before their recovery actions.
- `full-flow/external-links.json`: external HTTP checks. `full-flow/contact-*.jpg`: route/state overview sheets; the individual PNGs are the authoritative full-resolution captures.
- `qa-signer/connected-*.png`, `balance-block-*.png`, `receipt-*.png`, `position-*.png`: latest real signing run. Existing `before-*.png` and `after-production-*.png` preserve the production appearance comparison. No approved UI styling was changed. The phone's existing confirmation toast covers lower sheet content, while the receipt and hash remain readable.

The build, 14 web tests, frozen-lockfile install and real signing run pass. The Rust/SDK/MCP suite was not rerun because no contract, oracle, SDK or MCP code changed. All browsers and servers started for this QA are closed after verification; nothing was pushed.
