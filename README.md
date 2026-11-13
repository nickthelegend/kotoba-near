# Kotoba (言葉)

**Bet on what they'll say.** Kotoba is a mention prediction market on NEAR: trade YES or NO on words in an upcoming press conference.

People disagree about which words a speaker will use. Traders need real prices, a way to sell before the event, and a result they can check. Kotoba combines an on-chain order book with official-transcript settlement evidence.

## Try it

Node.js and pnpm 10.29.2 are required. No hosted URL is claimed. Reading markets and checking evidence needs no wallet or credentials. Proposed tracks, best first: **open**, then **privacy**; bets and transcripts are public, and the TEE provides verifiable execution rather than confidentiality.

1. Run `pnpm install --frozen-lockfile`, then `pnpm dev` from the repo root - see the local URL printed by Vite. Open it - see **Bet on what they'll say** and the real December event. Earnings calls and debates are labelled coming soon.
2. Open `/event/powell-dec-9` (also linked from `/app`) - see five on-chain word markets: Tariff, Recession, Inflation, AI and Employment. Select a word - see its real trade-price history and escrowed bids/asks. **Last fill %** uses the latest YES trade; the Yes/No buttons show current ask prices. On mobile, use Chart / Order book and Trade to reach the ticket.
3. Connect a funded Meteor `.testnet` wallet. Choose Buy, YES or NO, Limit or Market, price and whole shares - see the depth-based fill estimate, maximum cost, payout and storage fee. Submit and approve in Meteor - see a FINAL receipt linked to the explorer. A limit can rest; a market order fills available depth and returns its remainder. The 0.005 NEAR storage fee is nonrefundable, including an unfilled order.
4. Open `/portfolio` - see available cash, positions, trade-based P&L and open orders. Sell available shares through the event ticket or cancel your own resting order - see the final receipt and refreshed balances. Reload - see the state read from NEAR. P&L excludes storage/network fees and is unavailable for an unknown minted/transferred basis.
5. Open `/activity` - see actual matched trades. Demo accounts seeded this small book; this is not customer volume. Select Rules & resolution on the event - see the official transcript rule and September's recorded proof, with five browser checks rerun against live evidence. The separate SDK checks Intel's signature chain.
6. Open `/market/fomc-2026-09-inflation-replay` or `/resolved` - see previous-version settlement evidence. Both October judge replays below remain untouched for judges; do not consume them in filming or automated QA. Human Meteor approval remains a manual check; the four v3 filmed actions used the build-gated test wallet in the real app.

Trading units: **100¢ = 0.001 test NEAR per winning share, not US dollars**. YES and NO are separate books backed by fully collateralized pairs. Prices/volume/history are real contract state. The counter currently includes the **whole official transcript, including reporters**, not speaker-isolated recognition. December has not settled and its expected PDF is not published yet. Errors show retry or a specific field message; no successful receipt is invented.

## Live on NEAR testnet

Current order-book contract: [`kotoba-book-v3-20261113.testnet`](https://testnet.nearblocks.io/address/kotoba-book-v3-20261113.testnet). It holds escrowed cash/shares, retained orders and matched trades. [V3 deployment evidence](deployments/book-v3-2026-11-13.json) records deployment, all five markets, real seed trades and resting liquidity. A fresh Kotoba-owned helper-faucet account funded it; no old or other project's account was charged.

| Evidence | Transaction |
| --- | --- |
| Deploy and initialize v3 | [FoU1azKAuSaiAPnzWYFL8y28qDeDcCXURsxLW3mzozqX](https://nearvalidate.org/txns/FoU1azKAuSaiAPnzWYFL8y28qDeDcCXURsxLW3mzozqX?network=testnet) |
| Add the coherent snapshot view | [3UZowDUUBFZoBwiY9nMzJn8FFvJ37PgbKCQjgpEUgAHG](https://nearvalidate.org/txns/3UZowDUUBFZoBwiY9nMzJn8FFvJ37PgbKCQjgpEUgAHG?network=testnet) |
| In-app limit buy, filled at 66¢ | [2xsQDraurpzoVyX6TkJFXFbk2cdTFMpPs7VSnrdUUoSo](https://nearvalidate.org/txns/2xsQDraurpzoVyX6TkJFXFbk2cdTFMpPs7VSnrdUUoSo?network=testnet) |
| In-app market sell, filled at 60¢ | [5RiyMyhEvnPB9E1QP36qS1oSrzsiPaWqVdk1HfRgWRKc](https://nearvalidate.org/txns/5RiyMyhEvnPB9E1QP36qS1oSrzsiPaWqVdk1HfRgWRKc?network=testnet) |
| In-app cancel of a resting order | [5fUMHDvPL71kSu8t8iJe4vGV72Vhc4XxChWYEQt3JS1X](https://nearvalidate.org/txns/5fUMHDvPL71kSu8t8iJe4vGV72Vhc4XxChWYEQt3JS1X?network=testnet) |

Previous contract: [`kotoba-edfa2b47.testnet`](https://testnet.nearblocks.io/address/kotoba-edfa2b47.testnet); its links, replays, original oracle pin and payout records remain available. OutLayer resolution still uses `outlayer.testnet` and `worker.outlayer.testnet`. Settlement proofs below are historical previous-version evidence, not a claim that December or the new order book has settled.

Both contract accounts retain full-access keys for demo market/liquidity management and code upgrades. Deleting the last key would end operator signing/upgrades and strand the contract-account maker's own orders and holdings; other accounts could still call deployed methods. No key was deleted. This is upgradeable, unaudited testnet software, with 32 markets, 4,096 lifetime orders and 8,192 fills capped in the prototype.

## V3 contract and tests

`packages/book-contract` adds native-NEAR cash escrow, share escrow, maker-price matching with price-time priority, partial fills, market IOC refunds, cancellation, selling, complete-pair mint/redemption and callback-safe cash withdrawal. Self trades are skipped. Matching performs no external calls; withdrawal debits before transfer and reconciles a single private callback without overwriting concurrent credits. The legacy LMSR buy is disabled on v3. One snapshot supplies a coherent set of books, trades and account reads per refresh.

`CARGO_BUILD_JOBS=1 pnpm test` passed **57/57** tests: oracle 3, old contract unit 5 + sandbox 1, SDK 17, MCP 2, web 17, book unit 8 + sandbox 4. See [TESTING.md](TESTING.md) and [FLOW-QA.md](FLOW-QA.md). Full human Meteor approval, mainnet, confidential bets, gasless trading and general transcript sources remain outside the shown flow.

## Previous-version deployment evidence (Nov 9 2026)

The following deployment, LMSR and creator-fee records describe `kotoba-edfa2b47.testnet`. The new order book is a separate contract; no old market was migrated or rewritten.

- Factory contract: [`kotoba-edfa2b47.testnet`](https://testnet.nearblocks.io/address/kotoba-edfa2b47.testnet). Deploy tx [GT6mg7jY…](https://testnet.nearblocks.io/txns/GT6mg7jYHgAAe7ETHvpiebABgJU2mLgmBXCWtq4i66ea), init tx [Gz2LyFjq…](https://testnet.nearblocks.io/txns/Gz2LyFjqBaA9svLUoNC5yjQiaAv2AmD8banUnyMCL2QP).
- Oracle program (WASI P2), stored on FastFS: `https://test.fastfs.io/kotoba-edfa2b47.testnet/outlayer.testnet/b46b08da60dcd4d4970a0712beb0e1b33aab6e332646de4e090974419a7b2314.wasm`, SHA-256 `b46b08da60dcd4d4970a0712beb0e1b33aab6e332646de4e090974419a7b2314`. Upload txs: [9R7w4vtj…](https://testnet.nearblocks.io/txns/9R7w4vtjxpCsZoc7vuzk2i3iqapiTmSSPfq8UUGkiciF) and [mPZQ85xH…](https://testnet.nearblocks.io/txns/mPZQ85xHx4evsDFGmoXPNeMAeqDKUqLrkR91McCoczS).
- First direct OutLayer run, before the contract existed: [DSYxhNQq…](https://testnet.nearblocks.io/txns/DSYxhNQquvqFd96X7mod6eTXs28o4sAa45DBx1zx8dqt), request #14913. It counted 40 "inflation" in PDF `2c2683d9…5cd3`, using 789M instructions in 1.8 s and costing 0.00127 NEAR.
- **A past event, settled end to end.** The January 28, 2026 FOMC press conference (Powell) had two markets. "inflation" at least 40 times resolved **YES (40)**, was challenged and re-run (**40** again), went Final and paid out. "recession" at least once resolved **NO (0)**, was finalized after its challenge window and paid out. All three OutLayer runs have TDX attestations that pass every check below.
- **An upcoming event, live.** The scheduler read the official FOMC calendar and opened four markets for the **December 9, 2026** press conference: recession, inflation, tariffs and employment. They close at 19:25 UTC, five minutes before the 2:30 p.m. ET start. Live odds are on the board.

| Step | Result | Transaction |
| --- | --- | --- |
| create player sub-account | ok | [HWU7NPqqP2…](https://testnet.nearblocks.io/txns/HWU7NPqqP2LD62Q2eBVak8zyVmGVvmnXmCT9CrnVMM7S) |
| create market fomc-2026-01-inflation-40 | ok | [DDJBJq1gKY…](https://testnet.nearblocks.io/txns/DDJBJq1gKYUozj6Pk5oWxPSVb9KHcoL3ztxSHuUGHB75) |
| create market fomc-2026-01-recession | ok | [9jGxuGNaJm…](https://testnet.nearblocks.io/txns/9jGxuGNaJmq86qxaYNgj1cv9G1VqSFtPszw48RtCdTCk) |
| buy 25 YES on fomc-2026-01-inflation-40 | ok | [3TwLfxmR2n…](https://testnet.nearblocks.io/txns/3TwLfxmR2nA7NW8pwbQGSjXuZNhUHAEwiUJazFyr6BcK) |
| buy 10 NO on fomc-2026-01-inflation-40 | ok | [BYChi1bjSA…](https://testnet.nearblocks.io/txns/BYChi1bjSA7Z4ZJDZN4FKVBi3uaTQPZwjBgtDk3YRSyr) |
| buy 15 NO on fomc-2026-01-recession | ok | [FSAurVubcR…](https://testnet.nearblocks.io/txns/FSAurVubcRt4c6E1qJHyzGPDf6Hn7cSrJFQRC7ttkJqa) |
| resolve fomc-2026-01-inflation-40 (OutLayer) | rejected on-chain: `ERR_RESOLUTION_TIME` | [3PahtoukKP…](https://testnet.nearblocks.io/txns/3PahtoukKPJJvMMYPHe5YudFvWoEyTKxDKHqDcjiUGqj) |
| buy 1 YES on fomc-2026-01-inflation-40 | rejected on-chain: `ERR_CLOSED` | [23d3vj4BQa…](https://testnet.nearblocks.io/txns/23d3vj4BQaDJAgdK1jJxWyEvKYn5iPrhMBfvgE5V5h1a) |
| resolve fomc-2026-01-inflation-40 (OutLayer) | ok · TEE request #14918, attestation verified | [33sMfUjXnh…](https://testnet.nearblocks.io/txns/33sMfUjXnhbPmL3jad6ijjXZwYWYXodeHLH9fTQujAyV) |
| challenge fomc-2026-01-inflation-40 (OutLayer) | ok · TEE request #14919, attestation verified | [BT5BmcjyhU…](https://testnet.nearblocks.io/txns/BT5BmcjyhUdheNEMqNuwyB294e6oD9uqEa4Rk4rSP15E) |
| resolve fomc-2026-01-recession (OutLayer) | ok · TEE request #14920, attestation verified | [GiwqWBNzKt…](https://testnet.nearblocks.io/txns/GiwqWBNzKtN96xeRfkhhEJCVdzPHYwZm8znysas2bpGf) |
| claim fomc-2026-01-inflation-40 as player | ok | [Eoudkc8kzc…](https://testnet.nearblocks.io/txns/Eoudkc8kzcrL9qSydTm41HnfKk52gYJfdMQzMSvKUZFE) |
| claim fomc-2026-01-inflation-40 as creator | rejected on-chain: `ERR_NO_WINNING_SHARES` | [4HPAvPfnKh…](https://testnet.nearblocks.io/txns/4HPAvPfnKhxyeXVkDgMoj874BhX5L3qtXyNvTDujgrRf) |
| claim fomc-2026-01-inflation-40 as player | rejected on-chain: `ERR_NO_WINNING_SHARES` | [HLzDkSrJnz…](https://testnet.nearblocks.io/txns/HLzDkSrJnzhdF7RThgrFk66Wdn7wPt3kN7NGjtb7KT3x) |
| attack: forged on_result for fomc-2026-01-recession | rejected on-chain: `private` | [4b14MmNgrg…](https://testnet.nearblocks.io/txns/4b14MmNgrgiyATcGQfHPVPc5Cepd8VwDc4v54FxNh43X) |
| buy 12 YES on fomc-2026-12-inflation | ok | [A2PVdgjQ7C…](https://testnet.nearblocks.io/txns/A2PVdgjQ7C9vHK6oFoUVT8jUSPavoZs5DcVCf58cqzBf) |
| buy 8 NO on fomc-2026-12-recession | ok | [6N7AaiWfms…](https://testnet.nearblocks.io/txns/6N7AaiWfmsDBvoR9HB975TSf1RTHUnPjP33diW66fQ8M) |
| buy 5 YES on fomc-2026-12-tariffs | ok | [HsV3W2JqLm…](https://testnet.nearblocks.io/txns/HsV3W2JqLmX3uvM1zCausZWRX84cAXP7s5nMHi8ZuMwM) |
| finalize fomc-2026-01-recession | ok | [61M2LbzkmK…](https://testnet.nearblocks.io/txns/61M2LbzkmKjzi8wShPC5K8HPSePWtetp493FofZG3YG2) |
| claim fomc-2026-01-recession as player | ok | [EX1z8F8LDv…](https://testnet.nearblocks.io/txns/EX1z8F8LDvGYSFAiD92FrvoGzArD56UGVezfR5p9TBGf) |
| scheduler opens fomc-2026-12-recession from the Fed calendar | ok | [GibRyZH1ti…](https://testnet.nearblocks.io/txns/GibRyZH1ti95gVLpTdXU7wyM6ZysaBhdJYf5XxciLdC) |
| scheduler opens fomc-2026-12-inflation from the Fed calendar | ok | [BeihjRnbfz…](https://testnet.nearblocks.io/txns/BeihjRnbfzAzVjox7TPEv5jxdLE1o7ngg45MVLf2SfKq) |
| scheduler opens fomc-2026-12-tariffs from the Fed calendar | ok | [8XwUG72GJQ…](https://testnet.nearblocks.io/txns/8XwUG72GJQhaa5kTSQ2aQB2zToHBFKfE8ocHxeJ7JcTh) |
| scheduler opens fomc-2026-12-employment from the Fed calendar | ok | [AUBv3NUYGK…](https://testnet.nearblocks.io/txns/AUBv3NUYGKMHh6TvvfF5yLH6XzFibe8p65DxsXFajuat) |

Raw records: [deployments/real-run.json](deployments/real-run.json) (every tx with its exact OutLayer input, output, log and attestation check), [deployments/testnet-2026-11-09.json](deployments/testnet-2026-11-09.json), [deployments/oracle-fastfs.json](deployments/oracle-fastfs.json), [deployments/scheduler-2026-11-09.json](deployments/scheduler-2026-11-09.json).

### Judge replay

Two untouched October 28 transcript replays are available. Each is **one-shot**: the first resolver uses that market; another judge can use the other one. Both have closed betting and accept resolution until **November 26, 2026 at 00:00 UTC**. Both were read back Open with no result after the proof run. The original inflation market was not used for any R3 bet, resolve, challenge or finalize.

| Market route | Phrase | Creation transaction |
| --- | --- | --- |
| `/market/fomc-2026-10-inflation-replay` | inflation | [BfVTcefEgzCxMWwXN7BDga7D48ZKma6Fs6mMtYmTZEpw](https://testnet.nearblocks.io/txns/BfVTcefEgzCxMWwXN7BDga7D48ZKma6Fs6mMtYmTZEpw) |
| `/market/fomc-2026-10-employment-replay` | employment | [6LXBmLJBjLoyiFQF8hdWBumfBLDziHu13ftnzGYuHXo7](https://testnet.nearblocks.io/txns/6LXBmLJBjLoyiFQF8hdWBumfBLDziHu13ftnzGYuHXo7) |

Their [official October 28 PDF](https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20261028.pdf) returned HTTP 200; its SHA-256 is recorded in the deployment evidence. These are known-source replays, not forecasts. Their November demo windows deliberately differ from the October source date. Ordinary December markets still close before their future event.

Connect a funded Meteor testnet wallet and choose **Resolve with OutLayer · 0.12 NEAR**. Have at least **0.421 NEAR spendable** for the attachment and prepaid gas. The attachment includes a 0.1 bond and up to 0.02 for execution. Unused gas is returned. After the result, anyone can challenge during the 15-minute window or finalize once it ends. Human Meteor approval remains a manual check.

Fresh provisional and final results discover resolve/challenge transactions through the public NearBlocks v3 API, read the exact bytes from NEAR RPC receipts or the public NearBlocks receipt tree, and run the same five browser checks as the January panels. Failed lookups offer Try again and never show a pass. Intel-chain verification stays in the SDK; each live panel prints its exact command. January's recorded panels are unchanged. The replay PDFs are linked, but their extracted transcript text is not bundled.

**Proven on a separate September replay.** `/market/fomc-2026-09-inflation-replay` resolved through the app's QA signer, counted **22 inflation hits**, passed all six SDK checks, and was finalized after the 15-minute window. The finalize receipts include the bond return. These calls did not consume either judge market.

| Proof step | Transaction |
| --- | --- |
| Create | [5LT6xu9vD2Q1HSqdtom2MB7CEJPjV1EHD1UyExmDR5EP](https://testnet.nearblocks.io/txns/5LT6xu9vD2Q1HSqdtom2MB7CEJPjV1EHD1UyExmDR5EP) |
| Resolve through the app | [DkNvuJDwv9M2aPucpJWs3cgVwCMo8AsaUki8f2foNdkG](https://testnet.nearblocks.io/txns/DkNvuJDwv9M2aPucpJWs3cgVwCMo8AsaUki8f2foNdkG) |
| Finalize | [3sTUggZz8DWrqBjQQ3wmUqrKypSqn7GDC9QvrhEMip5c](https://testnet.nearblocks.io/txns/3sTUggZz8DWrqBjQQ3wmUqrKypSqn7GDC9QvrhEMip5c) |

Verify the live proof without a wallet or credentials:

```sh
node packages/sdk/scripts/verify-attestation.mjs --tx DkNvuJDwv9M2aPucpJWs3cgVwCMo8AsaUki8f2foNdkG --sender kotoba-edfa2b47.testnet
```

Evidence: [judge-path-proof-2026-11-12.json](deployments/judge-path-proof-2026-11-12.json), [R3 budget and untouched-market reads](deployments/r3-2026-11-12.json), [second creation](deployments/r3-create-second-2026-11-12.json). The complete R3 net spend was **0.0030905025308085 testnet NEAR**. New subsidies of 0.14 NEAR were allocated from the contract's existing pool; they were not external transfers. Additional storage locked was 0.00798 NEAR.

## Host it

This is a static Vite app with public testnet defaults and no server secrets. Build it with `pnpm --filter @kotoba/web build`; the output is `packages/web/dist`. No wallet credential, NEAR private key or API secret is needed for the build or read-only demo. The QA signer is removed from production, including when its development flag is set.

`vercel.json` builds only the web package and serves existing files before falling back to `index.html` for SPA routes. `.vercelignore` excludes credential files, environment files and local state. A production preview was hard-refreshed successfully on `/`, `/app` and a market detail at both widths. See [Vercel's configuration reference](https://vercel.com/docs/project-configuration/vercel-json).

When Nick is ready to publish, the one command from the repository root is:

```sh
pnpm dlx vercel --prod
```

Hosting was prepared but not deployed. Keep the eventual hosted app available through judging. Repo publication, the X post and human Meteor approval remain human steps.

## How settlement is verified

1. **Origin.** `resolve` and `challenge` call `request_execution` on `outlayer.testnet` with a `WasmUrl` source pinned by SHA-256. OutLayer pauses with NEAR yield/resume, runs the job and resumes. Its return value becomes the promise result read by our `#[private] on_result` callback. A direct call to `on_result` is rejected on-chain ([4b14MmNg…](https://testnet.nearblocks.io/txns/4b14MmNgrgiyATcGQfHPVPc5Cepd8VwDc4v54FxNh43X)). The callback also requires the returned `source_url` and `code_hash` to match the market and the pinned program. A failed run returns `null`, which refunds the bond and preserves the previous market state: open for an initial resolution, provisional for a challenge.
2. **Attestation**, from OutLayer's [WORKER_ATTESTATION.md](https://github.com/out-layer/outlayer/blob/main/WORKER_ATTESTATION.md). Each run publishes a TDX quote at `https://testnet-api.outlayer.ai/attestations/by-tx/<tx>`. `packages/sdk/src/attestation.mjs` checks six things:
   - the executed WASM hash equals the pin;
   - `sha256(input)` equals `input_hash`, using the exact input from the tx receipt;
   - `sha256(output)` equals `output_hash`, using the exact output the contract received;
   - the quote's `report_data` equals SHA-256 over the task fields;
   - the five TDX measurements are approved on `worker.outlayer.testnet` (`is_measurements_approved`);
   - the quote's Intel signature chain verifies with Phala's `dcap-qvl`. TCB status: `UpToDate`.

   Run it yourself: `node packages/sdk/scripts/verify-attestation.mjs deployments/outlayer-direct-DSYxhNQquvqFd96X7mod6eTXs28o4sAa45DBx1zx8dqt.json`. The resolution page re-runs the first five checks in your browser.
3. **The transcript.** `packages/web/public/archive-20260128.txt` is the oracle's own `lopdf` extraction of PDF `2c2683d9…5cd3`. The page checks its hash, highlights every whole-word hit and compares the browser count with the attested count (40 = 40).

## Previous-version wallet and CLI details

- `/`: the landing page with live contract figures (markets, open, settled, shares, free balance, verified TEE runs) and the recorded transactions.
- `/app`: the Dec 9 FOMC countdown and four live markets with LMSR odds. **Trade** opens the bet sheet with a live `quote` from the contract. **Connect** signs in with Meteor Wallet (testnet), and **Buy** sends a real `buy` transaction.
- `/market/fomc-2026-01-inflation-40`: the verdict (40 hits, YES), the transcript and program hashes, both OutLayer runs with the in-browser seal checks, and the transcript with all 40 hits marked and a hit-by-hit navigator.
- `/creators`: markets grouped by creator, and a composer that opens a new Fed-sourced market from your wallet (subsidy b·ln2, 1% creator fee).
- `/you`: your YES/NO shares (one NEP-245 batch read), with Claim on final markets and Refund on void ones.

**Connecting a wallet.** Kotoba signs with [Meteor Wallet](https://wallet.meteorwallet.app) on NEAR testnet. You need a `.testnet` account in Meteor (create or import one there; NEAR's guide is [Create an account](https://docs.near.org/getting-started/create-account), and free testnet NEAR comes from [near-faucet.io](https://near-faucet.io)). **Connect** opens Meteor in a pop-up (or its browser extension) at `wallet.meteorwallet.app/connect/testnet/login`, asking for a function-call key on the market contract; the result is posted back to the page, so there is no redirect. Calls with no deposit are then signed by that key without a pop-up; every bet, which attaches NEAR, opens Meteor for approval. If the browser blocks the pop-up, the app says so and asks you to allow pop-ups; closing the window says nothing was sent. MyNearWallet was removed on 2026-11-10: its testnet pop-up now answers "MyNearWallet can't connect to apps anymore" and points to Meteor.

Every write goes through one path (`packages/web/src/tx.ts`): it checks the wallet, the network (a `.near` account is refused) and the spendable balance against deposit + prepaid gas, applies the bet optimistically, waits for the wallet, follows the hash until NEAR executes it, then refreshes, or rolls back and shows the contract's own panic (for example `ERR_CLOSED`) with a next step. Odds poll every 10 s. The buy attaches the quote + 2% and the contract refunds the rest; a bigger move stops with "Price moved". Error shapes come from real testnet failures (`packages/web/test/fixtures/testnet-errors.json`).

CLI, against the live deployment:
```sh
node packages/sdk/scripts/scheduler.mjs                         # plan markets from the official Fed calendar (dry)
node packages/sdk/scripts/verify-attestation.mjs deployments/outlayer-direct-*.json
node packages/sdk/scripts/verify-transcript.mjs https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260128.pdf 2c2683d9d1f08b06668c0cf3257918e68dd748ef7a804dd14094e6e2c3e35cd3
NEAR_TESTNET_CONTRACT=kotoba-edfa2b47.testnet node packages/mcp/src/main.mjs   # MCP: list/get markets, verify a resolution tx
```
Reproduce the whole run on a fresh account with `packages/sdk/scripts/upload-oracle.mjs`, `deploy-testnet.mjs` and `real-run.mjs` (see its header for subcommands). Keys come from gitignored `.near-credentials/` or `.env` only.

## Previous-version components

| Package | What it is |
| --- | --- |
| `packages/contract` | Rust near-sdk 5.30 factory. Seeded LMSR (`b`, subsidy ceil(b·ln2)×0.001 NEAR), native-NEAR escrow, NEP-245 YES/NO shares (`mt_transfer`, `mt_transfer_call`, batch, views), a 1% creator fee paid on each buy, close time and resolution deadline, OutLayer resolve, one bonded challenge re-run, finalize after the challenge window (15 min on this testnet deployment), burn-on-claim payout, and `claim_void` (half a unit per share if nothing settles by the deadline). |
| `packages/oracle` | Rust WASI P2 program run by OutLayer. It fetches only `https://www.federalreserve.gov/mediacenter/files/FOMCpresconfYYYYMMDD.pdf`, hashes it, extracts the text with `lopdf`, collapses whitespace and counts case-insensitive whole-word matches. Reporters' questions count. |
| `packages/sdk` | LMSR maths, the Fed calendar parser, the official PDF fetcher, the attestation verifier, a 1Click dry-quote helper (gated on a funded mainnet account), and the deploy, upload, run and scheduler scripts. |
| `packages/mcp` | MCP stdio server with `kotoba_list_markets`, `kotoba_get_market` and `kotoba_verify_resolution` (reads a resolve tx from chain and verifies its attestation). |
| `packages/web` | Vite + React app: landing, board, bet sheet, resolution page and creators. Reads come from NEAR RPC and OutLayer's API, with nothing mocked. Writes go through NEAR Wallet Selector 10.1.4 and Meteor Wallet. |

## NEAR features used, and why

- **OutLayer TEE + yield/resume:** a verifiable off-chain read of a public document that a contract cannot fetch itself.
- **FastFS:** the program bytes live on NEAR at a hash-named URL, so the code that settles a market cannot change after deploy.
- **NEP-245 multi-token:** two share classes per market in one contract, transferable with callbacks.
- **Named sub-accounts:** the demo player is `player.kotoba-edfa2b47.testnet`. Per-market escrow sub-accounts are *not* built: escrow sits in the factory.
- **NEAR Intents 1Click:** dry quote helper only. Without a funded mainnet account it returns "Setup required".

## Limits, stated plainly

The LMSR scripts and creator fee above belong to the previous version. V3 adds early selling and cancellation through the real order book; it has no LMSR backstop.

- Sources are Fed press conference PDFs only. White House briefings and earnings calls have no reliable free transcript feed (see [docs/RESEARCH.md](docs/RESEARCH.md)). Podcast and creator transcript URLs are future work.
- The contract trusts the OutLayer promise result, not a quote it verifies on-chain. The TDX quote is verified off-chain, by the SDK, the MCP tool and the browser.
- Email sign-in, NEP-366 gasless bets and NEP-141 collateral are not built. Bets use a NEAR testnet wallet and native testnet NEAR. See [BLOCKED.md](BLOCKED.md).
- Shares are small: 1 share = 0.001 NEAR payout, because the recorded demo funding was 4 NEAR.
- Previous-version LMSR shares cannot be sold through a book. V3 adds real early selling; old holdings remain on the old contract.

## Tests

`CARGO_BUILD_JOBS=1 pnpm test` builds all three WASM targets and passes 57 tests (November 13): oracle 3, previous contract 6, SDK 17, MCP 2, web 17, book contract 12. The November 12 R4 count of 45 remains historical. See [TESTING.md](TESTING.md) for the real browser flow and current limits.

## Hackathon disclosures

Built for NEAR HACKATHON 2026 (Nov 1-14). Submission deadline: November 14, 2026 at 23:59 UTC. See the [official rules](https://nearhackathon.com/HACKATHON.md).

### Prior work

The current [Q-001](https://nearhackathon.com/HACKATHON.md) counts work from the October 19, 2026 announcement through November 14; earlier code is baseline. No pre-October 19 commits appear in this repository's complete local history. The first commit, `feffd1e` (November 9), contains only the MIT license and `.gitignore`. There is no tracked NOTICE file or former project name. The existing inspiration notes name Mentioned and Memetic Machines; they are references, not sibling codebases, and no code was reused from them.

November 13 adds the new on-chain CLOB, seeded five-word event, category-layout app and v3 film. The November 9-10 commits add the NEAR contract, LMSR pricing, NEP-245 shares, OutLayer transcript program, FastFS upload, deployment and settlement records, scheduler, SDK, MCP tools, web app, tests and Meteor Wallet integration. Only NEAR work built in the hackathon window is presented for judging. Review the implementation since the initial scaffold with `git diff feffd1e..HEAD -- packages deployments scripts docs package.json pnpm-workspace.yaml pnpm-lock.yaml`; inspect dated commits with `git log --reverse --date=iso-strict --format='%h %ad %s'`.

November 11-12 adds the browser QA signer and real browser buys, the published-transcript judge replay, and the local 3D art kit. These are also inside the eligible window.

Libraries include near-sdk, near-workspaces, lopdf, near-api-js, NEAR Wallet Selector, Phala dcap-qvl, the MCP SDK, React and Vite. Dependency versions are recorded in the package manifests and lockfiles. No reused team library or template is identified in the repository.

### AI-assisted code

Built with AI coding agents (Claude Code, Codex) under human direction; all code reviewed and tested by the team.

### Other projects by the same team in this hackathon

Lead: <TBD by Nick>

### License

MIT. See [LICENSE](LICENSE), Copyright (c) 2026 Nivesh Gajengi.

## Art

3D art generated with ChatGPT: a vintage-enamelware object kit in Kotoba's coral and cream, described in [docs/ART-3D.md](docs/ART-3D.md).

## Inspiration and license

Inspired by [Mentioned](https://colosseum.com/arena/projects/explore/mentioned) and [Memetic Machines](https://colosseum.com/arena/projects/explore/memetic-machines-war-machine), both in [Colosseum's Frontier 2026 top 25](https://blog.colosseum.com/announcing-the-winners-of-the-solana-frontier-hackathon/). No code was reused. MIT, Copyright (c) 2026 Nivesh Gajengi.
