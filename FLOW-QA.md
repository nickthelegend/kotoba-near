# Full-flow QA

## V4 — kotoba-markets.testnet, 2026-11-13

Screens captured at 1440 and 390 into `grokbot/orchestration/shots/kotoba/v4/` (outside the repo): `home`, `markets`, `event_fed_2026_12_09`, `event_fed_2026_12_09_rules`, `activity`, `portfolio`. Horizontal overflow was 0 on every route at both widths; console errors appeared only while every public RPC answered HTTP 429, and the page then showed its busy/retry state. Polymarket and Kalshi refused automated Chrome from this network (SSL errors), so the layout follows their public structure from the brief; nothing of theirs ships.

| Step | Result |
| --- | --- |
| Landing | Sticker hero "Bet on what they'll say." with the live chance of the top word and a countdown; live board (top words + chart), stats from chain, how it works with the real order book and latest fills, the seal section, FAQ, footer. |
| Markets | Featured December event with top words, Yes/No quotes and a multi-line chance chart; two live event cards; "next on the mic" (no fake cards); resolved markets from the previous contract with their counts. |
| Event | 12 words with chance, ▲/▼ since first fill, Buy Yes/Buy No; selected row expands its order book (Trade Yes / Trade No mirror, depth bars, last, spread, flashing changed levels); sticky ticket (Buy/Sell, Market/Limit, Yes/No, shares, average fill from the book, cost, fee, payout, receipt). Mobile: rows stack, bottom Buy Yes/No bar opens the ticket as a sheet, bottom tab bar. |
| Live trading (film take, QA signer = test wallet, real testnet) | Market buy 10 Yes on Oil filled at the asks; limit bid 5 Yes on Housing at 30¢ rested and showed in the book; cancelled from Portfolio with the escrow returned; sold 5 Oil Yes into the best bid. Hashes in `deployments/film-v4-2026-11-13.json`. |
| Portfolio | Positions marked at the live chance, P&L against own fill prices, open orders with Cancel, history, cash with Withdraw; disconnected state with Connect. |
| Activity | Every fill on the contract with trader, side, word, price, value, time; demo makers labelled. |
| Rules & resolution | Per-word thresholds, whole-transcript scope (reporters included), close-to-payout steps, the January 28, 2026 market's seal re-checked live (five checks pass) plus the recorded Intel chain. |
| Errors | RPC busy bar with retry and last good snapshot; wallet errors and contract errors mapped to plain sentences (ERR_SELF_CROSS, ERR_CASH, …); invalid price/shares disable the button with a reason. |

## V3 prediction-market flow — 2026-11-13

New contract `kotoba-book-v3-20261113.testnet`; previous contract and all its markets remain unchanged. Baseline, reference attempts and after captures are saved outside the repo. Kalshi/Polymarket rejected automated Chrome with SSL errors; Manifold and both local picks were inspected. The explicit brief supplied the category structure.

| Ordered step | Status and result | Capture names |
| --- | --- | --- |
| 1. Landing → understand | PASS: Bet on what they'll say; one real December event; other categories coming soon. | `after-home-{1440,390,375}.png` |
| 2. Browse → event | PASS: five actual word markets; real history; seeded volume labelled. % means last YES fill; buttons mean asks. | `after-event-*.png` |
| 3. Select outcome / book | PASS: YES/NO books, real bids/asks, cumulative NEAR totals, last price/spread, price-time ordering. Mobile chart/book tabs and Trade jump work. | `after-event-*.png` |
| 4. Connect | PASS with scoped development test wallet; production Meteor uses testnet and the new contract. Human Meteor sign-in/approval remains manual. | `connected-event-*.png` |
| 5. Limit buy → receipt | PASS: real app-signed order matched one YES at 66¢; displayed price moved 62% → 66%; FINAL receipt. | Film `hook.png`; transaction below |
| 6. Market sell → receipt | PASS: one YES sold at real 60¢ bid; cash credited, YES position returned to 3. | Film `sell.png` |
| 7. Portfolio / reload | PASS: network shares, available cash, real-price P&L, own trade history. Storage/network fees excluded. | `portfolio-*.png`, `portfolio-reloaded-*.png` |
| 8. Resting bid → cancel | PASS: real 10¢ bid rested, owner cancelled, cash unlocked and zero open trader orders. | Film `cancel.png` |
| 9. Activity | PASS: actual fills only, demo seeding explicit. | `after-activity-*.png`, `activity-*.png` |
| 10. Rules / resolution | PASS: official whole-transcript scope including reporters; five fresh browser checks on dated September proof; Intel SDK command separate. | `after-rules-*.png`, `rules-*-viewport.png` |
| 11. Errors / empties | PASS: disconnected portfolio; NO held = 0 disables sale; too-large YES sell disabled with actual holdings; NO chart explicitly has no fills. No signed error-state transaction. | `sell-no-market-*.png`, film `limits.png` |
| 12. Previous version | PASS: legacy September detail and original links still work. No automatic write targets either October replay. | `after-previous-*.png` |

The 18 signed-out route checks at 1440/390/375 had zero console/page/network errors, overflow or raw error text and five seal checks at every width. Connected read-only audit results are recorded separately in `deployments/qa-book-browser-*.json`. The full unit/integration suite passed 57/57. The film used four real UI transactions, not terminal calls:

| Action | Hash |
| --- | --- |
| Limit buy, filled | `2xsQDraurpzoVyX6TkJFXFbk2cdTFMpPs7VSnrdUUoSo` |
| Market sell, filled | `5RiyMyhEvnPB9E1QP36qS1oSrzsiPaWqVdk1HfRgWRKc` |
| Place resting bid | `GhN9ioTm9wWiaFJ3NV9ej8aTYH6GUV7eFbJ8NzVm9hpP` |
| Cancel that bid | `5fUMHDvPL71kSu8t8iJe4vGV72Vhc4XxChWYEQt3JS1X` |

Total filmed wallet spend: **0.0173925160301097 testnet NEAR**. No additional signatures were made to finish read-only scenes after interruption. Independent UI review found proof/label contrast and a buried mobile ticket; those were fixed with readable proof text/links, darker labels and mobile chart/book tabs plus Trade jump. Old evidence below remains dated previous-version history.

Production preview: **24/24 cases pass** at 1440/390/375, including hard refresh on `/`, `/app`, `/event/powell-dec-9`, `/portfolio`, `/activity` and the previous September detail. Meteor opens its real testnet login with the new contract ID; closed and blocked messages pass at every width. These checks perform no signature or spend. Evidence: `deployments/v3-production-qa-2026-11-13.json`. The connected audit separately passed 18/18 cases, zero spend; ordinary signed-out checks passed 18/18. A first wallet-message test used an incorrect exact-text locator; the corrected alert locator passes. Human approval remains manual.

## R3 live-resolution proof — 2026-11-12

**DONE:** fresh live seals, a separate browser-signed proof, a second untouched judge replay and a host-ready static build. No public deploy, push, film change or contract-key change was performed.

| Step | Executed result | Evidence |
| --- | --- | --- |
| Dead links | PASS: the prescribed tracked-Markdown grep is empty, excluding the submission worksheet. Old result rows and PASS/FAIL/BLOCKED labels were preserved. | Local capture references are plain filenames. |
| Discovery | PASS: 2 live tests discover the exact January resolve/challenge hashes through NearBlocks v3 and public receipts; 1 explicit HTTP 429/mainnet rejection test and 14 existing web tests also pass (17/17). Failed lookups never invent a pass. | `packages/web/test/discovery.test.ts` |
| Existing January pages | PASS at 1440 and 375: same recorded panels, six labelled rows per run and same content/layout. Screenshot differences are limited to text rasterization. | `before-fomc-2026-01-*.png`, `after-fomc-2026-01-*.png` |
| September proof | PASS: the app's Resolve button used the scoped QA signer. OutLayer returned 22 inflation hits. All six SDK checks pass, including Intel chain / UpToDate. | [Proof record](deployments/judge-path-proof-2026-11-12.json) |
| New live seal | PASS at 1440 and 375: five browser checks, with Intel labelled check with the SDK and an exact transaction command. Deliberate indexer failure has no green pass; Try again recovers against real services. | `after-fomc-2026-09-inflation-replay-*.png`, `lookup-failure-*.png` |
| Finalize | PASS through the app after the actual 15-minute window. The receipt returns the 0.1 NEAR bond to the resolver account. A first browser wait timed out before any signed hash was recorded; a fresh attempt succeeded. | Finalize `3sTUggZz8DWrqBjQQ3wmUqrKypSqn7GDC9QvrhEMip5c` |
| Two judge markets | PASS: both October markets remain Open with no result; the original market's complete fields match its pre-proof snapshot. No R3 write targeted it. Each is one-shot, deadline November 26 00:00 UTC. | [R3 ledger and state reads](deployments/r3-2026-11-12.json) |
| Production / hosting | PASS: build excludes QA signer even with its flag forced on; hard refresh on `/`, `/app` and the proof detail passes at both widths. Host config has filesystem-first SPA fallback and secret exclusions. No hosting was executed. | `vercel.json`, `.vercelignore`, `after-checks.json` |
| Full route audit | PASS: 75 production cases at 1440 and 375, covering all nine market details, navigation, wallet popup messages, quotes, positions and error/retry states. All 69 ordinary cases have zero console/page/network/HTTP errors, overflow, raw error text or pending placeholders; all internal links map to known routes. Six deliberate service-failure cases remain labelled expected faults. | `r3/full-flow/audit.json` and per-step PNGs |

Create `5LT6xu9vD2Q1HSqdtom2MB7CEJPjV1EHD1UyExmDR5EP` → Resolve `DkNvuJDwv9M2aPucpJWs3cgVwCMo8AsaUki8f2foNdkG` → Finalize `3sTUggZz8DWrqBjQQ3wmUqrKypSqn7GDC9QvrhEMip5c`. The second judge market creation is `6LXBmLJBjLoyiFQF8hdWBumfBLDziHu13ftnzGYuHXo7`. Total net spend for all four writes: **0.0030905025308085 testnet NEAR**, below 0.05 and 0.3. Additional storage locked: **0.00798 NEAR**. Subsidies of 0.14 NEAR were allocated from the contract's existing pool, not sent externally. Only this repo's deployer credential was loaded, by path in Node; the player and other projects were not funded or debited.

Read-only browser checks: 6 baseline checks and 14 production/live-seal/recovery/hard-refresh checks, with zero page errors and no horizontal overflow. SDK tests: 17/17 pass. The production proof's transaction bytes come from public receipts, not a bundled proof fixture. Rust/oracle/MCP suites were not run in R3; their code is unchanged. Screenshots were captured locally during QA and are not committed.

An initial full audit completed 75 cases with 73 PASS and 2 FAIL: its write-blocking guard also blocked the read-only `EXPERIMENTAL_tx_status` request on the September page. The guard now allows that receipt read while still blocking broadcasts. `first-audit.json` preserves those failures; a later interrupted attempt was incomplete. The final corrected run completed all 75 cases with 0 failures.

The QA signer scopes this run to the September id and resolve/finalize methods. Its spending reservation uses twice the live RPC gas price, while balance preflight separately retains the conservative prepaid-gas allowance. Testnet-only and 0.3 NEAR spending guards remain active. A before/after balance is recorded around every write. The proof was not used to resolve or challenge either judge market.

Remaining manual steps: human Meteor approval, public repo and X post, host deployment and final team/payout disclosures. The contract's full-access authority remains; deleting it is Nick's decision. Intel verification remains off-chain and the browser explicitly sends judges to the SDK for that sixth check.

## Judge-readiness update — 2026-11-12 (historical R2)

The R3 section above supersedes the earlier single-replay and missing-live-panel limitations.

**PASS: 71 production-browser cases and four targeted replay checks at 1440×900 and 375×812.** The replay checks never signed or sent a resolution. The November 11 results below remain historical.

- **FIXED:** the submission tracks now propose `privacy` first, then `open`, with an explicit note that bets and transcripts are public. `defi` was removed. BLOCKED no longer names a cross-project funder or says the existing film is missing.
- **DONE:** `fomc-2026-10-inflation-replay` exists on the current testnet contract, created in [BfVTcefEgzCxMWwXN7BDga7D48ZKma6Fs6mMtYmTZEpw](https://testnet.nearblocks.io/txns/BfVTcefEgzCxMWwXN7BDga7D48ZKma6Fs6mMtYmTZEpw). Source: the published October 28 Fed PDF. Creation, PDF hash and balance evidence: [deployments/judge-market-2026-11-12.json](deployments/judge-market-2026-11-12.json).
- **PASS:** visit `/market/fomc-2026-10-inflation-replay` → see the replay label, published-source link and Connect to resolve. A restored public deployer session sees Resolve enabled. A restored low-balance player session clicks it and receives the mapped balance error before a wallet popup or signing. All four checks record zero write RPCs and page errors. Unregistered fixture keys authorize no real account; no funded credential was loaded by the browser checks.
- **FIXED:** closed-but-uncounted markets are excluded from Resolved and Settled filters. The phone event card says Awaiting resolution and links to Resolve the market. The known replay PDF is described as published. Final cards no longer imply every winner already claimed. No styles, fonts, colours, layout or art changed.
- **OPEN FOR JUDGES:** bets closed on November 12 at 06:53:55.989 UTC; resolution remains allowed until November 26 at 00:00 UTC. A resolver needs at least 0.421 testnet NEAR spendable for the 0.12 attachment and prepaid gas. We deliberately left the market uncounted. It is a one-shot replay: the first resolver consumes the open state; later judges inspect the result and can finalize after the 15-minute challenge window. No new TEE result, seal verification or payout PASS is claimed.
- **BUDGET:** the creation reserved a 0.121 NEAR call budget, including the 0.07 subsidy and conservative prepaid gas. It burned **0.0002048429592783 NEAR** and locked **0.00283 NEAR** more in storage. The deployer called its own contract, so the subsidy was allocated from its existing pooled balance; it was not an external transfer. The script reserved 0.376 NEAR for existing markets before creating this one. No other project's account was used; this preparation stays below the 0.3 testnet NEAR cap.
- **PASS:** web production build, all 14 web tests and all 17 SDK tests (including live attestation verification). Contract/oracle code was not changed or rebuilt. The official Q-001 now counts code from October 19; the README baseline wording matches it. Kotoba's first commit remains November 9.
- **MANUAL / BLOCKED:** actual human Meteor approval, public hosting, repo publication, the X post and final lead/contact/payout/other-project fields remain Nick's actions. The replay's extracted text and future attestation panels are not automatically bundled; its official PDF and the SDK verifier are available as documented in the README. The film exists, but it was not re-shot in this pass.

Screenshots and diagnostics now use `kotoba` with the orchestration Chrome lock. `judging-r2/before/` and `judging-r2/after/` each contain Board, Resolved, future-market and replay captures at both widths, plus `checks.json`. `judging-r2/resolve-checks.json` and `resolve-{funded-view,low-balance}-{1440,375}.png` record the targeted real-data checks. `full-flow/audit.json` contains the 71 passing cases and all per-step screenshots. Ordinary cases had zero console errors, page errors, failed requests, HTTP errors, overflow, undefined/NaN text or loading placeholders; deliberate outages remain labelled expected faults. [TESTING.md](TESTING.md#published-transcript-judge-replay-2026-11-12) explains how to repeat the read-only checks. All owned browser/server processes were closed after verification.

Screenshots were captured locally during QA and are not committed.

## November 11 production walkthrough

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

Base: `kotoba`.

- `full-flow/audit.json`: 69 passing cases, per-step diagnostics, screenshot paths, internal/external links and public Meteor login request fields. Outage cases have `expected_fault: true`; all ordinary cases have zero console/network/page errors, no overflow and no pending placeholders.
- `full-flow/<width>-<stem>.png`: full-page screenshots at 1440 and 375. Separate `*-state.png` captures retain disconnected, unknown-market and mainnet states before their recovery actions.
- `full-flow/external-links.json`: external HTTP checks. `full-flow/contact-*.jpg`: route/state overview sheets; the individual PNGs are the authoritative full-resolution captures.
- `qa-signer/connected-*.png`, `balance-block-*.png`, `receipt-*.png`, `position-*.png`: latest real signing run. Existing `before-*.png` and `after-production-*.png` preserve the production appearance comparison. No approved UI styling was changed. The phone's existing confirmation toast covers lower sheet content, while the receipt and hash remain readable.

The build, 14 web tests, frozen-lockfile install and real signing run pass. The Rust/SDK/MCP suite was not rerun because no contract, oracle, SDK or MCP code changed. All browsers and servers started for this QA are closed after verification; nothing was pushed.

Screenshots were captured locally during QA and are not committed.
