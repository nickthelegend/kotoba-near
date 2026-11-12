# Verification — 2026-11-09

`pnpm test` from the repository root builds both WASM files first. The current source defines **45 tests** (28 in the November 9 suites, 14 web error-mapping tests added November 10, and 2 live discovery tests and 1 failure-injection test added November 12). Earlier totals of 33 and 47 were arithmetic errors; the suite counts below are unchanged. These are recorded verification results; the full suite was not rerun for the docs-only submission pack. `pnpm --filter @kotoba/web test` alone: **14 passed, 0 failed** (Nov 10).

| Suite | Tests | What ran |
| --- | ---: | --- |
| Oracle (Rust) | 3 | The whole-word rule, the official URL allowlist, and the pinned real Fed PDF (hash `2c2683d9…5cd3`: 40 `inflation`, 0 `recession`). |
| Contract unit (Rust) | 5 | LMSR prices sum to 1, complete-set cost, monotonic cost, no risk-free complete set, finite extreme prices. |
| Contract sandbox (near-workspaces, real local nearcore) | 1 | Signed transactions against the real contract WASM. It covers market creation, a buy with the creator fee, NEP-245 transfer and transfer-call refund, and void-market refund at half a unit (once). It also rejects a bad source URL, a double-spaced phrase, unauthorized transfer, an underfunded buy, a direct call to the private callback, a premature claim, early resolution, a challenge before any result, a late buy, a void claim before the deadline, a double void claim, and resolution after the deadline. |
| SDK (Node) | 17 | Pricing, the phrase rule, fixture hashes, a live official PDF fetch and calendar parse, and a live OutLayer cost view. **Live deployment tests:** the recorded resolution re-verifies (all six attestation checks, Intel chain via dcap-qvl); a tampered output (`count` 39) fails the output-hash check; a changed program hash changes the task hash; the deployed contract holds the settled Jan 28 markets (Final, 40, transcript hash, program hash; recession 0). |
| Web error mapping (node:test, Nov 10) | 14 | `packages/web/test/errors.test.ts` maps error shapes captured from NEAR testnet (`test/fixtures/testnet-errors.json`, written by `scripts/capture-errors.mjs`) to the message the app shows: view-call panics, recorded and new failing transactions, NotEnoughBalance, UNKNOWN_ACCOUNT for a `.near` name, UNKNOWN_TRANSACTION, OutLayer 404, FastNEAR's real 429 body, dRPC's broadcast timeout, and the MyNearWallet popup strings read from the installed module. Two shapes are constructed and labelled so: an HTTP 429 with no body and a browser `Failed to fetch`. |
| MCP (Node) | 2 | A real stdio server: the tool list and setup error with no contract, then `kotoba_list_markets` and `kotoba_verify_resolution` against the live testnet resolve tx (count 40, verification ok). |

No chain or external API is mocked. Live tests read NEAR testnet (FastNEAR, with the official RPC as fallback) and `testnet-api.outlayer.ai`.

## Public testnet run (attack and edge cases on the real chain)

All of these are in [deployments/real-run.json](deployments/real-run.json) with explorer links. The README has the table.

| Case | Expected | Observed |
| --- | --- | --- |
| Resolve before close | reject | `ERR_RESOLUTION_TIME` ([3Pahtouk…](https://testnet.nearblocks.io/txns/3PahtoukKPJJvMMYPHe5YudFvWoEyTKxDKHqDcjiUGqj)) |
| Bet after close | reject | `ERR_CLOSED` ([23d3vj4B…](https://testnet.nearblocks.io/txns/23d3vj4BQaDJAgdK1jJxWyEvKYn5iPrhMBfvgE5V5h1a)) |
| Resolve via OutLayer | count 40 and attestation verified | request #14918, all checks pass |
| Challenge re-run | same code re-runs; resolver keeps the bond | request #14919, count 40, Final |
| Winning claim | pays 25 × 0.001 NEAR | ok ([Eoudkc8k…](https://testnet.nearblocks.io/txns/Eoudkc8kzcrL9qSydTm41HnfKk52gYJfdMQzMSvKUZFE)) |
| Double claim | reject | `ERR_NO_WINNING_SHARES` ([HLzDkSrJ…](https://testnet.nearblocks.io/txns/HLzDkSrJnzhdF7RThgrFk66Wdn7wPt3kN7NGjtb7KT3x)) |
| Losing side claims | reject | `ERR_NO_WINNING_SHARES` ([4HPAvPfn…](https://testnet.nearblocks.io/txns/4HPAvPfnKhxyeXVkDgMoj874BhX5L3qtXyNvTDujgrRf)) |
| Forged resolver call (`on_result` directly) | reject | `Method on_result is private` ([4b14MmNg…](https://testnet.nearblocks.io/txns/4b14MmNgrgiyATcGQfHPVPc5Cepd8VwDc4v54FxNh43X)) |
| Finalize after the 15-minute window, then claim NO | pays | ok ([61M2Lbzk…](https://testnet.nearblocks.io/txns/61M2LbzkmKjzi8wShPC5K8HPSePWtetp493FofZG3YG2), [EX1z8F8L…](https://testnet.nearblocks.io/txns/EX1z8F8LDvGYSFAiD92FrvoGzArD56UGVezfR5p9TBGf)) |

The transcript-swap case: the challenge rule compares `count` and `transcript_sha256` between the two runs and pays the challenger if either changed. The live challenge got the same PDF hash and count, so the resolver kept the bond. A real swap would need the Fed to republish the PDF, which we cannot cause. The SDK tests show that changed PDF bytes change the hash. The contract compares the previous and new count and hash; the sandbox does not exercise a changed-transcript callback.

## Browser QA

Nov 9 2026, after the news-markets UI rebuild. `vite build` passes. On the dev server at port 5198, `node scripts/check-web.mjs` drove headless Chrome (playwright-core, channel `chrome`) over every route at 1440 and 390, and we screenshotted each route again at 375.

| Route | 1440×900 (desktop: off-white, sidebar) | 390×844 and 375×812 (phone: dark, tab bar) |
| --- | --- | --- |
| `/` | no overflow, 0 page errors | no overflow, 0 page errors |
| `/app` | 2-column card grid of the 4 open Dec 9 markets, live LMSR odds | event carousel, week strip (Dec 9: 4 markets), market list |
| `/app` with a sheet open | YES/NO bet sheet shows the live contract quote (0.0061 NEAR for 10 shares) | "Your call" event sheet, then the bet sheet as a bottom sheet with the same quote |
| `/resolved` | the 2 settled Jan 28 markets | same |
| `/you` | "No wallet connected" state with Connect | same |
| `/market/fomc-2026-01-inflation-40` | 5 of 5 in-browser seal checks pass on both runs; browser count 40 = attested 40 | same |
| `/market/fomc-2026-12-inflation` | countdown, live odds, YES/NO buttons open the bet sheet | same |
| `/creators` | no overflow, 0 page errors | no overflow, 0 page errors |

FastNEAR (`test.rpc.fastnear.com`) often answers HTTP 429 without CORS headers, which Chrome logs as a console error. Reads then fail over to `near-testnet.drpc.org`, and the data still loads. `rpc.testnet.near.org` is deprecated and answers every call with a -429 body, so we removed it from the list. The dev server was stopped afterwards.

## Web behaviour: errors triggered for real (Nov 10 2026)

`node packages/web/scripts/capture-errors.mjs` signed these as `player.kotoba-edfa2b47.testnet` through near-api-js 5.0.0, the library MyNearWallet's function-call key uses in the browser. Each landed on testnet and failed in the contract; the app shows the panic it parses from the RPC error.

| Trigger | Contract / RPC said | App shows | Tx |
| --- | --- | --- | --- |
| buy 10 YES with 1 yocto attached (price moved / underpaid) | `ERR_DEPOSIT` | "The price moved before your bet landed. Get a fresh quote and buy again." + Try again | [6Usp2PMX…](https://testnet.nearblocks.io/txns/6Usp2PMXDqmjf39DeDAzfVABbUkjjTeFpxCyarZC9BSj) |
| buy 0 shares | `ERR_QUANTITY` | "Choose between 1 and 100,000 shares." | [9P5bTVnx…](https://testnet.nearblocks.io/txns/9P5bTVnxaWwgfQD1qKDEhpYEubzbkw8xC2d6Ey332upW) |
| buy on a market id that does not exist | `panicked at src/lib.rs:98:48: ERR_UNKNOWN_MARKET` | "This market does not exist on the contract." | [GPLkM1nN…](https://testnet.nearblocks.io/txns/GPLkM1nNWF4EgJnR6r4PfvfHTL2Rq3SyCnoK3wPJw8N7) |
| claim on an open market | `ERR_NOT_FINAL` | "Winnings are not claimable yet." | [674bYFgu…](https://testnet.nearblocks.io/txns/674bYFgugaxZQoy7mQjDuuM84Gyc9iGwrKYSgMzB5sFM) |
| buy on the settled Jan market | `ERR_CLOSED` | "Bets on this market are closed." | [6Qb3Jy11…](https://testnet.nearblocks.io/txns/6Qb3Jy116PtN9s9eTMZqecicViBHaPrkppA3cCVnkrTw) |
| buy with 50 NEAR attached; challenge with 0.105 NEAR + 30 Tgas | `NotEnoughBalance` (rejected before landing, no fee) | "Not enough NEAR: you have 0.123, this needs 50.03." | none (InvalidTxError) |

Also captured: view-call panics (`quote` with 0 and 100,001 shares, `prices` on an unknown id), `view_account nick.near` → `UNKNOWN_ACCOUNT` (shown as "That is a mainnet account"), an unknown tx hash → `UNKNOWN_TRANSACTION`, OutLayer `attestations/by-tx` → HTTP 404 for a tx it never executed, and four recorded failing transactions from the Nov 9 run read back with RPC `tx`. During QA FastNEAR rate-limited us for real (HTTP 429, body `{"error":{"code":-429,"message":"Rate limits exceeded…"}}`; Chrome sees it as a CORS failure), and dRPC answered a broadcast with `Request timeout on the free plan` (code 30) for a buy that still landed ([BmR8kmNW…](https://testnet.nearblocks.io/txns/BmR8kmNWwbKtdCtiF4UpcP4VkUtnnRrNTgLPUhcBdYTW)). The app now fails over on code 30 and, when a broadcast times out, follows the hash instead of reporting a failure.

Prepaid-gas calibration: testnet rejected 30, 100 and 300 Tgas calls as costing deposit + 0.0309, 0.1009 and 0.3009 NEAR, so the balance check before every write is `deposit + Tgas × 0.001 + 0.001 NEAR` against the balance minus the storage lock.

### Browser QA of the error states (headless Chrome, `vite build && vite preview`, port 5871)

The connected states load a real account into wallet-selector's storage (`signedAccountId`, as MyNearWallet writes it after sign-in) without any key, so every read is live and nothing can be signed. Network failures are produced by blocking or answering the RPC hosts in the browser (Playwright routing), not by app code.

| State | How it was produced | Result at 1440 and 375 |
| --- | --- | --- |
| RPC down | both RPC hosts aborted | "Cannot reach NEAR testnet. Check your connection and retry." + Try again; no overflow |
| Rate-limited | both hosts answer HTTP 429 | after one 1.5 s back-off: "The NEAR RPC is rate-limiting us. Wait a few seconds and retry." |
| Unknown market | `/market/fomc-2099-01-nothing` | empty state "No market called …" with Back to the board |
| Invalid shares | type `1.5`, then `0` | inline "Whole shares only", "Buy at least 1 share"; Buy disabled |
| Insufficient balance | player (0.098 NEAR) types 100,000 shares | live quote 101 NEAR, Buy disabled: "You have 0.098 NEAR; this order needs 103 NEAR with slippage and gas." |
| Wallet closed | Buy 2 YES: the real popup opens at testnet.mynearwallet.com and is closed | "You closed the wallet without approving. Nothing was sent." + Try again; the optimistic +2 YES is rolled back; no error toast (shown inline) |
| Mainnet account | `nick.near` in wallet storage | banner "That is a mainnet account. Sign out and connect a .testnet account." with Sign out; /you shows the same |
| Attestation not yet available | OutLayer answers 404 | the seal card shows "The TEE attestation is not published yet. Retry in a minute." + Try again; the rest of the page renders |
| Positions | player | 12 YES "inflation", 8 NO "recession" read with one `mt_batch_balance_of` |
| Live odds | a real buy of 5 NO on "employment" by the player while the board is open ([5XnoPDce…](https://testnet.nearblocks.io/txns/5XnoPDceYqq1BKZGJVcofL4NXrn7S2LuXjXwbgwmonwB)) | the card moved from Yes 53% to Yes 52% on the next 10 s poll, with no reload |

Every route (`/`, `/app`, `/market/…` open and settled, `/you`, `/creators`, `/resolved`) at 1440 and 375 after these changes: no horizontal overflow and no page errors. The only console errors are the browser's own "Failed to load resource" lines in the scenarios that block the network on purpose, and FastNEAR's real CORS-less 429s, which fail over to dRPC.

Real buys made during this QA by `player.kotoba-edfa2b47.testnet` on `fomc-2026-12-employment` (it went from 0/0 to 22 YES / 15 NO): 20 YES and 2 × 1 YES from runs whose dRPC broadcast timed out but which landed (one hash recorded: [BmR8kmNW…](https://testnet.nearblocks.io/txns/BmR8kmNWwbKtdCtiF4UpcP4VkUtnnRrNTgLPUhcBdYTW); NearBlocks' API was rate-limited, so the other two hashes are not recorded), then 10 NO ([6sxYo71v…](https://testnet.nearblocks.io/txns/6sxYo71veapYZMbpnaGNPcPEzaDTpfnRh6nr9cYbJ64f)) and 5 NO ([5XnoPDce…](https://testnet.nearblocks.io/txns/5XnoPDceYqq1BKZGJVcofL4NXrn7S2LuXjXwbgwmonwB)).

Not exercised in a browser: a signed success through MyNearWallet (needs a human to approve in the wallet), claim and finalize (no market is claimable or past its window right now), and the error boundary (no panel throws on real data).

### Wallet: Meteor Wallet replaces MyNearWallet (2026-11-10)

MyNearWallet's testnet pop-up now refuses every app. Clicking **Connect** on the previous build (`vite preview`, headless Chrome) opened `testnet.mynearwallet.com/login/?…&contract_id=kotoba-edfa2b47.testnet…`, which answered "MyNearWallet can't connect to apps anymore … is being retired and no longer accepts new app connections" and offered "Get Meteor Wallet". The rows above that name MyNearWallet were recorded before this change.

The web app now uses `@near-wallet-selector/core` 10.1.4 with `@near-wallet-selector/meteor-wallet` 10.1.4 (MyNearWallet removed). Meteor's SDK peers on near-api-js 6, and the selector's `@near-js/*` 2.x packages peer on `@near-js/utils` 2, so `pnpm-workspace.yaml` gives the wallet packages their own near-api-js 6.2.5 and `@near-js/utils` 2.5.1; the app's own reads stay on near-api-js 5.0.0.

Checked against `vite build && vite preview` in headless Chrome at 1440×900 and 375×812:

- **Connect** (header pill on `/app`) opens a pop-up at `https://wallet.meteorwallet.app/connect/testnet/login?…`. The request the app posts into it reads `actionType: login`, `network: testnet`, `contract_id: kotoba-edfa2b47.testnet`, `type: ALL_METHODS` with a fresh public key.
- Closing that pop-up shows "You closed the wallet without approving. Nothing was sent."
- With pop-ups blocked (`window.open` returning null), it shows "Your browser blocked the wallet window. Allow pop-ups for this site, then try again."
- No console errors, no horizontal overflow at 375 on `/app` and `/you`. `/you` offers **Connect with Meteor Wallet**.
- `node --test test/*.test.ts`: 14/14. The wallet-error test now reads the closed-window, cancelled, pop-up-failed and not-signed-in strings from the installed Meteor SDK and module.

Not done: a full Meteor sign-in and approval. Meteor's site sits behind Cloudflare, which shows headless Chrome "Sorry, you have been blocked", and signing in needs a person with a Meteor testnet account.

## QA signer browser e2e (2026-11-11)

The app's connect → buy → final receipt → You → reload path now passes with real testnet signatures at 1440×900 and 375×812. This is a separate two-viewport integration run, not an addition to the 42 unit/integration tests counted above. [FLOW-QA.md](FLOW-QA.md) records the scope, screenshots, transaction links and remaining manual Meteor approval check.

Prerequisites: Node with `import.meta.dirname` support, pnpm, installed Google Chrome (Playwright channel `chrome`), macOS `sysctl` and `lsof`, the shared Chrome lock module at the path below, and the existing funded demo player's `.near-credentials/player.json` in this repo. Do not copy or print that file. Its account must be `player.kotoba-edfa2b47.testnet`.

```sh
pnpm install --frozen-lockfile
pnpm test:e2e
```

`scripts/qa-browser.mjs` performs these checks and actions:

1. Read the real testnet balance, one-share quote and market state before loading the credential. Stop with `LOW TESTNET BALANCE` if two buys plus conservative prepaid gas reserves cannot be funded. Do not fund or debit another project.
2. Check free swap before the production build and Chrome launch. Below 500 MB, wait two minutes and check again.
3. Build with `VITE_QA_SIGNER=1` and grep every production asset for QA module names and injection markers; fail if any remains. The wallet also requires Vite's `DEV` flag, so production builds omit it even when the QA flag is set.
4. Under `withChromeLock`, launch Chrome, capture the production UI, then start a separate QA dev server. The shared module is `chrome-lock.mjs`. Servers select free ports starting at 5583/5584, never above 5999. The runner closes its browser and server process groups on exit.
5. Reject a mainnet account and RPC. For each viewport, load the existing key in Node and inject it with `page.addInitScript`, restricted to the local app origin. Connect through the app, check decimal and unfunded-order errors without signing, then buy exactly one YES share on `fomc-2026-12-employment`.
6. Wait for `FINAL`, independently verify the on-chain transaction, check the app's receipt/hash and updated position, and reload You to confirm persistence. Assert zero page errors, no wallet popups, no horizontal document overflow and no key in localStorage or sessionStorage.

This command spends testnet NEAR. It does not mock RPCs. The current daily evidence file reserves deposit plus conservative gas for every signed hash, including uncertain broadcasts, and refuses another buy if cumulative reservations would exceed 0.3 NEAR. The signer separately caps its session at 0.3 NEAR, allows only named `.testnet` accounts, approved testnet RPC URLs and function calls to this deployment's contract. It signs once and follows the known hash after a broadcast timeout.

The credential stays in Node/page memory and the wallet's in-memory key store. The runner disables inherited Playwright debug logging and does not create traces, HAR, video, storage-state files or credential copies. Only public transaction fields are persisted, before broadcast, in `deployments/qa-browser-<UTC-date>.json`. Screenshots go to `qa-signer`.

Initial November 11 result: both viewports PASS, 42 → 44 YES across two real buys; total balance decrease **0.00263368737922 testnet NEAR**. Web build and all **14 web tests** also pass. The latest origin-guard hardening was checked with matching-localhost and rejected external/blank-origin cases without sending further transactions. A human Meteor sign-in and approval remains manual; this run does not claim new browser coverage of creation, settlement, challenge or claims.

Screenshots were captured locally during QA and are not committed.

## Full production walkthrough (2026-11-11)

The read-only screen audit is `pnpm test:flow` (`node scripts/full-flow-qa.mjs`; `scripts/check-web.mjs` delegates to it). It uses installed Google Chrome and the same shared `withChromeLock` as the signing test. It exercises landing, board, all six market details, resolved, You and creators at 1440×900 and 375×812, plus filters, phone schedule/event sheets, quotes, transcript navigation/hash copy, Meteor's real popup URL/request, cancellation/blocking, public-account restored sessions, validation, empty states, simulated outages and retry recovery. It records screenshots and per-step console errors, page errors, failed requests, HTTP errors, overflow and bad-text checks in the scratchpad's `flow-qa/kotoba/full-flow/audit.json`.

Check `sysctl vm.swapusage` before building; below 500 MB free swap, wait two minutes and check again. Check the chosen port with `lsof`; if 5591 is occupied, choose another free port in 5300–5999 and use that URL in both terminals.

```sh
lsof -nP -iTCP:5591 -sTCP:LISTEN
pnpm --filter @kotoba/web build
pnpm --filter @kotoba/web exec vite preview --host 127.0.0.1 --port 5591 --strictPort
```

In a second terminal:

```sh
KOTOBA_WEB=http://127.0.0.1:5591 pnpm test:flow
```

Stop the preview with Ctrl-C when finished. The audit closes its own browser. It blocks write RPC methods and never loads a funded account's credential. To restore production position screens, it uses a fresh unregistered test key in an ephemeral browser context with a public account id; this is a read-only fixture, not a Meteor login or an authorized account signer. Only the explicitly named outage tests intercept service responses. Use `pnpm test:e2e` separately for actual browser signatures and final receipts, within the testnet spending cap.

The walkthrough found an upstream `console.log(accessKey)` in Meteor SDK 1.0.24's sign-in method. `patches/@meteorwallet__sdk@1.0.24.patch`, registered in the workspace manifest and lockfile, removes it from the source and both published JavaScript entry points. The fix changes no UI or wallet protocol. Production build and the 14 web tests passed after the patch; the screen audit also checks for key debug objects without saving their contents. See [FLOW-QA.md](FLOW-QA.md) for the final results and external-service limits.


The later full-flow rerun after the Meteor logging fix also passed at both widths: 44 → 46 YES, spending another 0.00263368737922 testnet NEAR. Exact hashes and limits are in [FLOW-QA.md](FLOW-QA.md).

## Published-transcript judge replay (2026-11-12)

This historical R2 pass predates the second judge market and live-seal panel described in the R3 section below.

`node packages/web/scripts/judge-market.mjs` performs a read-only preflight when no saved transaction exists. Its one-time `--send` path created `fomc-2026-10-inflation-replay` using the existing deployer credential by file path. It reserves 0.121 NEAR (0.07 subsidy plus conservative prepaid gas and allowance), verifies the official PDF, preserves existing markets' share exposure and seeds, records the signed hash before broadcasting, and follows that same hash after a timeout. After creation, rerunning the command only rechecks the saved transaction and market; it does not sign again. Public evidence is [deployments/judge-market-2026-11-12.json](deployments/judge-market-2026-11-12.json).

The replay's source is the published October 28 PDF. Its deliberate demo close is November 12, 06:53:55.989 UTC, and its resolution deadline is November 26, 00:00 UTC. This separation is labelled as a replay in the app and README. It remains uncounted for the first judge to resolve; no new TEE count or attestation is claimed. The first resolver consumes this one-shot open state.

After building and starting a production preview on a free port in 5300–5999, run:

```sh
KOTOBA_WEB=http://127.0.0.1:5592 node packages/web/scripts/check-judge-market.mjs
KOTOBA_WEB=http://127.0.0.1:5592 pnpm test:flow
```

The targeted check reads the real market, confirms that its deadline covers judging, and checks the enabled Resolve button with a restored public deployer session. A restored low-balance player session clicks Resolve and gets the real balance-preflight error before any signing. Both viewports use a fresh unregistered fixture key; no funded key is loaded and all write RPCs are blocked. No resolution is sent. Screenshots and `resolve-checks.json` are under `judging-r2`. Before/after UI captures are in its `before/` and `after/` folders. The existing design, fonts, colours and art are unchanged.

The full audit now includes seven market routes and writes to `full-flow`. Both browser scripts use `chrome-lock.mjs`. Check `memory_pressure | tail -1` before builds and browsers; wait while free memory is below 30%. Earlier November 11 evidence paths and results above are historical. The November 12 web build, 14 web tests and 17 SDK tests pass; the contract and oracle were not changed or rebuilt.

Screenshots were captured locally during QA and are not committed.

## R3 live seal and judge path (2026-11-12)

Executed: web 17/17 (14 error-mapping + 2 real discovery tests + 1 explicit failure test), SDK 17/17, six baseline browser checks and fourteen production checks covering seals, failed lookup/retry and SPA hard refresh. The final production route audit passes 75/75 cases at both widths, including all nine market details. All 69 ordinary cases have clean console, page, request and HTTP diagnostics, no overflow/raw error text/loading placeholders, and no unknown internal routes. Six deliberately injected outage cases are labelled expected faults. Its initial 75-case run had two failures because the harness blocked read-only receipt lookup; that allowlist was corrected. An interrupted retry is not counted as a completed run. No Rust, oracle or MCP build/test was run. No public deploy or film change was made.

```sh
pnpm --filter @kotoba/web test
pnpm --filter @kotoba/sdk test
pnpm --filter @kotoba/web build
node packages/web/scripts/r3-read-checks.mjs
node packages/sdk/scripts/verify-attestation.mjs deployments/judge-path-proof-2026-11-12.json
node packages/sdk/scripts/verify-attestation.mjs --tx DkNvuJDwv9M2aPucpJWs3cgVwCMo8AsaUki8f2foNdkG --sender kotoba-edfa2b47.testnet
```

All six attestation checks pass on the September proof. Its creation, QA-signed Resolve, callback output, Finalize and bond-return receipt are in `judge-path-proof-2026-11-12.json`; every hash, per-write balances, cumulative budget and untouched October reads are in `r3-2026-11-12.json`. These completed deployment records are sealed evidence. Re-running a creator with a completed record is read-only; the proof runner refuses to sign a method already recorded.

Discovery uses the public NearBlocks v3 account history and client-side resolve/challenge filters. It cross-checks signer, receiver and exact market id against public transactions, then extracts the exact OutLayer request and output bytes. If archival RPC is unavailable, the NearBlocks receipt tree supplies the exact emitted request-data log and base64 output; the code follows the actual promise return to the successful factory callback. A transfer receipt alone cannot establish success. Both paths still require independent input/output hash checks against OutLayer. The transaction-mode SDK command was rerun successfully for both the September proof and January inflation resolution, with all six checks and UpToDate Intel collateral. Historical RPC 429/timeouts and a transient indexer 429 were observed; exhausted retries remain an honest retry state. The deployed contract has no transaction-hash view. API failures, incomplete history or missing receipts produce a retry state. No bundled proof record is used to pass the September browser seal. Existing January panels retain their recorded Intel row; new panels give the exact SDK command instead of asserting an Intel-chain check in the browser.

`r3-read-checks.mjs` starts and closes its own production preview. Its `--before` mode requires an explicitly supplied baseline checkout; it is not needed for routine rechecking. It records before/after screenshots at both widths, checks the five live rows and the unverified SDK instruction, deliberately aborts the public lookup, retries it against real services, and hard-refreshes production routes. It also greps every production asset for QA signer markers. That check passed after a build with `VITE_QA_SIGNER=1`. `vercel.json` and `.vercelignore` prepare static hosting without keys or a server backend.

`r3-proof.mjs` performed the real Resolve and Finalize through the app with a QA signer restricted to the September market. Only Node reads the existing deployer file; the page receives the key in memory at its own origin. No credential copies, traces or storage-state exports are made. Public transaction evidence is saved before broadcast; uncertain broadcasts follow the same hash. A first Finalize wait timed out with no signed hash or state change; the retry succeeded after the actual window. Both October markets remained Open with no result.

For the full read-only audit, start `pnpm --filter @kotoba/web exec vite preview --host 127.0.0.1 --port 5596 --strictPort` in one terminal, then run `KOTOBA_WEB=http://127.0.0.1:5596 pnpm test:flow` in another. Check that port is free first, and stop the preview afterward. The final result is `audit.json` (75 cases, 0 failures); `first-audit.json` preserves the earlier two harness failures.

The R3 screenshots are referenced by basename in the QA report: before/after market PNGs, `lookup-failure-1440.png`, `lookup-failure-375.png`, and `after-checks.json`. Screenshots were captured locally during QA and are not committed. All browser launches use the shared orchestration Chrome lock and require at least 30% free system memory. Every server/browser started for this pass is closed after verification. The reserved October market must never be used by automated write tests.
