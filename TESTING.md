# Verification — 2026-11-09

`pnpm test` from the repository root: **47 tests** (33 from Nov 9 plus 14 web error-mapping tests added Nov 10). It builds both WASM files first. `pnpm --filter @kotoba/web test` alone: **14 passed, 0 failed** (Nov 10).

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

The transcript-swap case: the challenge rule compares `count` and `transcript_sha256` between the two runs and pays the challenger if either changed. The live challenge got the same PDF hash and count, so the resolver kept the bond. A real swap would need the Fed to republish the PDF, which we cannot cause; the sandbox and SDK cover the hash comparison.

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

