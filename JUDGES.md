# Judge guide: Kotoba (NEAR HACKATHON 2026)

For human judges and for the Claude Code / Codex screening pass (HACKATHON.md Q-017). Every claim below has a command or a link that checks it.

## In one paragraph

**Product:** Kotoba is a word-mention prediction market on NEAR testnet. Each word a speaker might say (for example "inflation" at a Fed press conference) is its own Yes/No market with an on-chain order book.
**Problem:** Mention markets are settled by people: a bonded proposal and a token-holder vote, or the exchange's own committee. The result depends on who is asked.
**What Kotoba does:** A pinned counting program (WASM, sha256 `b46b08da…2314`) reads the official Fed transcript PDF inside an Intel TDX enclave on OutLayer. The market contract (`kotoba-edfa2b47.testnet`) starts that run itself and accepts the result only from the OutLayer callback. Anyone can bond 0.1 NEAR to re-run the same program; the re-run is final. Trading uses a separate order-book contract (`kotoba-markets.testnet`).
**Tracks:** `open` (primary) and `privacy` (secondary), from [HACKATHON_SUBMISSION_FORM.md](HACKATHON_SUBMISSION_FORM.md). Bets and transcripts are public; the enclave gives verifiable execution, not confidentiality.

## Verify in one command (no install, no keys)

```sh
node scripts/judge-verify.mjs
```

Needs Node 18+ and nothing else. It checks public data, not our own files: the FastNEAR transaction API, the NEAR testnet RPC (a `tx` call per transaction, archival RPC first; see the RPC note below), contract view calls, the FastFS copy of the oracle program, and the contract source. Public endpoints rate-limit at times; the script retries with backoff, and a run takes seconds. A normal run takes a few seconds. Expected output: `24/24 checks passed.` on the last line; exit code 0 only if all 24 pass. The table groups the 24 checks.

| # | Check | Source of truth |
|---|---|---|
| 1 | `resolve` calls `outlayer.testnet` `request_execution`; the callback `on_result` is `#[private]` | `packages/contract/src/lib.rs`, `packages/book-contract/src/lib.rs` |
| 2 | Deploy and event listings on `kotoba-markets.testnet` (3 txs) | NEAR testnet txs `DmLGSK…`, `8iVvLv…`, `HckEA7…` |
| 3 | Order-book trades: market buy, resting limit bid, cancel, market sell (4 txs) | txs `8d1tEM…`, `Cn7Y5b…`, `BqnKAf…`, `8vvQdG…` |
| 4 | OutLayer TEE run through the contract counted 40 "inflation"; output carries the pinned `code_hash`; contract callback returned `true` | tx `33sMfU…` |
| 5 | Challenge: the same program re-ran and counted 40 again | tx `BT5Bmc…` |
| 6 | Second market: TEE counted 0 "recession" | tx `GiwqWB…` |
| 7 | Player claim paid after settlement; recession market finalized | txs `Eoudkc…`, `61M2Lb…` |
| 8 | Separate Sep 2026 replay resolved through the app (count 22) and finalized | txs `DkNvuJ…`, `3sTUgg…` |
| 9 | Refused: resolve before the event ends (`ERR_RESOLUTION_TIME`) | tx `3Pahto…` |
| 10 | Refused: buy after betting closed (`ERR_CLOSED`) | tx `23d3vj…` |
| 11 | Refused: claim without winning shares (`ERR_NO_WINNING_SHARES`) | tx `4HPAvP…` |
| 12 | Refused: forged `on_result` call ("Method on_result is private") | tx `4b14Mm…` |
| 13 | The oracle WASM on FastFS hashes (sha256) to the pinned `code_hash` | FastFS download, hashed locally |
| 14 | `get_market`: the Jan 28 2026 "inflation" market is Final, count 40, same `code_hash` | `kotoba-edfa2b47.testnet` view |
| 15 | `config` pins the same program hash at init | `kotoba-edfa2b47.testnet` view |
| 16 | `list_markets`: 17+ word markets including the Dec 9 2026 FOMC event | `kotoba-markets.testnet` view |
| 17 | `get_book` for "oil": resting bids and asks, uncrossed | `kotoba-markets.testnet` view |

Each transaction line prints the signer and an explorer link `https://testnet.near.rocks/tx/<hash>`. Checks 4 to 6 and 8 read the OutLayer receipt output (`count`, `code_hash`) from the transaction's receipts, so they pass only if the enclave run really happened in that transaction.

**RPC note.** For each transaction the script first reads the transaction and its receipts from the FastNEAR transaction API, then cross-checks it with an RPC `tx` call using the signer from that response. The public RPC sometimes answers HTTP 429 or stalls on older transactions. After three misses the script stops asking, and a line before the final count reports `N confirmed, M skipped`. A skipped cross-check does not fail a check, which then rests on the transaction API alone; the view-call, code-hash, FastFS, Bitcoin and source checks do not depend on it.

## Do X → see Y

1. **`pnpm install --frozen-lockfile && pnpm dev`**, open the printed URL. You see the landing page with live chances read from the order book.
2. **Open `/event/fed-2026-12-09`.** You see 12 word markets, each with Buy Yes / Buy No prices, a chance chart from real fills, and the selected word's order book.
3. **Open `/event/fed-2026-12-09/rules`.** You see the rule per word and a settled market's TEE seal re-checked in your browser (five checks).
4. **Re-check a settlement from the shell:** `node packages/sdk/scripts/verify-attestation.mjs --tx DkNvuJDwv9M2aPucpJWs3cgVwCMo8AsaUki8f2foNdkG --sender kotoba-edfa2b47.testnet` prints the TDX attestation checks for that run.
5. **Run the contract tests:** `pnpm test:book` (12 unit tests including a 2,500-step randomized solvency session, and 4 sandbox tests on the compiled WASM). `pnpm --filter @kotoba/web test` runs the web tests. Counts per suite are in [TESTING.md](TESTING.md). Rust and `cargo near` are needed for the contract suites.
6. **Trading needs a funded Meteor testnet wallet** (not required for reading). One winning share pays 0.001 test NEAR.

## How Kotoba uses NEAR (specific)

| NEAR feature | How Kotoba uses it | Where |
|---|---|---|
| OutLayer (TDX enclave execution) | `resolve` and `challenge` call `outlayer.testnet` `request_execution` with a pinned WASM and a PDF URL; the callback `on_result` stores the count | `packages/contract/src/lib.rs`, `packages/oracle/src/main.rs`, checks 1, 4–6 |
| Private callbacks (`#[private]`) | Only the contract itself can deliver the oracle result, so a forged result is refused on chain | check 12 |
| FastFS | The pinned oracle program is stored on-chain-addressed storage and verified by hash | `deployments/oracle-fastfs.json`, check 13 |
| NEP-245 multi-token | YES/NO shares are exposed as `mt_*` tokens on the order-book contract | `packages/book-contract/src/lib.rs` |
| Native NEAR escrow, promises | Bids lock NEAR, asks lock shares; withdraw debits first and re-credits if the transfer promise fails | `packages/book-contract/src/lib.rs` |
| Meteor Wallet via wallet-selector | Browser signing on testnet | `packages/web/src/wallet.ts` |
| MCP server | Agent tools for markets and verification | `packages/mcp/` |

## Limits (read before scoring)

- **Contract-routed OutLayer `resolve` has failed since Nov 14.** Seven `resolve` calls through `kotoba-edfa2b47.testnet` that day returned "Execution promise failed" from OutLayer; the contract refunded each bond and kept the market Open. Direct `request_execution` runs of the same program succeeded (`deployments/outlayer-direct-*.json`). The cause is not found. The settlements verified above were made on Nov 9 and Nov 12, before it. `judge-verify.mjs` does not include any Nov 14 resolve, because it would fail. Details: [BLOCKED.md](BLOCKED.md) item 0.
- The two judge replay markets (`fomc-2026-10-inflation-replay`, `fomc-2026-10-employment-replay`) are Open and may not settle while that failure lasts.
- No order-book market has settled yet: the Dec 9 2026 event has not happened. Settlement proofs come from the previous contract (`kotoba-edfa2b47.testnet`), which the order-book contract's resolution flow reuses unchanged.
- The TDX quote is verified off chain (SDK, MCP, browser), not inside the contract. The contract trusts the OutLayer promise result.
- Email sign-in, gasless bets, 1Click funding and creator transcript sources are not built. Collateral is native testnet NEAR. Demo liquidity comes from Kotoba-owned maker accounts.
- Testnet only, not audited, upgradeable (the contract account keeps a full-access key). No hosted URL is claimed.

## Repository map

- `packages/book-contract/`: order-book contract (`kotoba-markets.testnet`): per-word books, mint/merge matching, escrow.
- `packages/contract/`: previous LMSR market contract (`kotoba-edfa2b47.testnet`) with the OutLayer resolve/challenge/claim flow.
- `packages/oracle/`: the counting program (Rust, WASI P2) that runs in the enclave.
- `packages/sdk/`: attestation and transcript verification, scheduler, deploy scripts. `packages/mcp/`: MCP server. `packages/web/`: the app.
- `deployments/`: raw records of every live run (transactions, OutLayer inputs and outputs). `scripts/`: browser QA scripts and `judge-verify.mjs`.
- `docs/POSITIONING.md`: sources for the Polymarket and Kalshi comparison.

## Rules compliance

- Built during the window: the first commit `feffd1e` (Nov 9) holds only the licence and `.gitignore`; see README "Prior work".
- Public repo and MIT licence (`LICENSE`).
- Demo post on X with the film (`kotoba-near-film.mp4`).
- Other team projects are named in the README (Q-015).
