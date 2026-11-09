# Kotoba (言葉)

Kotoba is a testnet prototype for markets on words in public transcripts. The problem is that a person can settle a word bet selectively or change the cited transcript. Kotoba pins a transcript source and a WASM code hash, prices YES/NO shares with a seeded LMSR curve, and routes resolution through an OutLayer callback with a challenge rerun. The current build has not completed a live OutLayer execution, so **automatic settlement is not yet verified end to end**.

## Reproduce

Requires Node 22+, pnpm 10, Rust 1.95, cargo-near 0.22 and the `wasm32-unknown-unknown` and `wasm32-wasip2` targets. Install and run from this repository:

```sh
pnpm install
pnpm test
pnpm build
pnpm dev
```

Open the Vite URL. You will see `Setup required: VITE_NEAR_TESTNET_CONTRACT` until a deployment is configured. This is the expected state, not a sample market. `pnpm test` builds both WASM files and runs contract unit tests, signed transactions on a real near-workspaces sandbox, a live fetch of the official Fed PDF and calendar, SDK tests and MCP tests. [TESTING.md](TESTING.md) records the counts.

To inspect the official calendar plan without signing anything:

```sh
node packages/sdk/scripts/scheduler.mjs
```

It currently plans four word markets for the December 9, 2026 FOMC press conference: `recession`, `inflation`, `tariffs`, and `employment`, threshold 1 each. It closes them five minutes before the scheduled 2:30 p.m. Eastern conference. The scheduler deduplicates by querying contract state when run with `--send`; no schedule execution has yet occurred on testnet.

## What is implemented

| Component | What a reviewer can verify |
| --- | --- |
| `packages/contract` | Rust near-sdk contract with seeded LMSR quotes, native NEAR escrow, YES/NO shares, NEP-245 views/transfers/transfer-call, a 1% trade fee paid to the creator, close time, private OutLayer callback, one bonded challenge, and burn-on-claim payout. Sandbox tests send signed transactions and demonstrate rejection of forged callback and other attacks. |
| `packages/oracle` | Rust WASI P2 program that fetches only official Fed press conference PDFs over HTTPS, hashes the PDF, extracts text with `lopdf`, and counts case-insensitive whole words/phrases. A real January 2026 PDF is pinned as a fixture. |
| `packages/sdk` | LMSR math, official source fetch, live Fed calendar parser, live OutLayer testnet cost view, and a read-only 1Click `dry: true` quote method gated on a funded mainnet account. |
| `packages/web` | Responsive landing page and market dashboard. Live odds and the position preview quote come from the testnet contract RPC. It shows explicit setup, empty and error states and a hash-checked archive word heatmap. Browser bets require the missing email/relayer layer. |
| `packages/mcp` | Read-only MCP tools `kotoba_list_markets` and `kotoba_get_market`, backed by live testnet RPC. Without `NEAR_TESTNET_CONTRACT`, they return a setup error. |

### Counting rule

All occurrences in the **full official press conference PDF** count, including reporters' questions. `lopdf` extraction collapses whitespace, then matching ignores ASCII case and requires non-alphanumeric boundaries around the word or phrase. The January 28, 2026 PDF SHA-256 is `2c2683d9d1f08b06668c0cf3257918e68dd748ef7a804dd14094e6e2c3e35cd3`. The oracle counts **40** occurrences of `inflation` and **0** of `recession`; Poppler extraction gives a different inflation count, so the extractor is part of the pinned code. Source: [Federal Reserve PDF](https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260128.pdf). Research: [docs/RESEARCH.md](docs/RESEARCH.md).

Verify the PDF hash against the live official source with:

```sh
node packages/sdk/scripts/verify-transcript.mjs https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260128.pdf 2c2683d9d1f08b06668c0cf3257918e68dd748ef7a804dd14094e6e2c3e35cd3
```

### NEAR features

- **NEP-245** represents each market's YES/NO share classes and supports balance, supply, direct and callback transfers. Payout burns winning shares.
- **OutLayer TEE** is the intended transcript oracle. The contract calls `outlayer.testnet` using a hash-pinned WASI source, and only its private callback accepts output. A testnet execution and independent attestation check remain blocked.
- **NEAR Intents 1Click** is exposed only as a dry quote preview in the SDK. It cannot fund a testnet market from mainnet, and there is no swap execution path.
- **Named subaccounts, function-call keys, NEP-366 meta transactions, NEP-141 collateral and email sign-in** are not implemented. Current escrow is within the factory account in native testnet NEAR.

Any testnet account can create a Fed-source market by paying the LMSR subsidy. The contract quote includes a 1% fee that is sent to that creator on each buy. Custom creator transcript URLs are still pending.

## Deployment and evidence

| Network | Contract / artifact | Action | Transaction / independent check | Status |
| --- | --- | --- | --- | --- |
| Local near-workspaces sandbox | `kotoba-contract` WASM | Create market, buy, transfer and attack calls | Reproduced by `pnpm test`; sandbox is ephemeral | PASS |
| NEAR testnet | No deployment | Account creation via official helper | Helper returned HTTP 429 on 2026-11-09; no transaction exists | BLOCKED |
| OutLayer testnet | WASI P2 artifact SHA-256 `cc1391dae45ced2c8e56ca5061010b8c56b73a1c8e29ac959a39210acaa9ac6e` built locally | Upload and execute official PDF | Live cost view passed; no execution ID or attestation exists | BLOCKED |
| NEAR mainnet Intents | No transaction | 1Click quote is dry only | `NEAR_MAINNET_ACCOUNT` not configured | BLOCKED |

No explorer transaction links are claimed because no public-chain transaction has succeeded. The exact dependencies are in [BLOCKED.md](BLOCKED.md). This repository has no remote; Nick publishes it, not the build agent.

## Demo commands

```sh
pnpm install && pnpm test && pnpm build
node packages/sdk/scripts/scheduler.mjs
pnpm dev
```

For the MCP read surface after deployment: `NEAR_TESTNET_CONTRACT=<real-account>.testnet node packages/mcp/src/main.mjs`.

## Team and other projects

Lead: <TBD by Nick>

Other project by this lead: <TBD by Nick>. NEAR HACKATHON Q-015 permits at most two independent projects per person; Nick must fill the actual disclosure before submission.

## Inspiration and license

Inspired by [Mentioned](https://colosseum.com/arena/projects/explore/mentioned) and [Memetic Machines](https://colosseum.com/arena/projects/explore/memetic-machines-war-machine), both named in [Colosseum's Frontier 2026 top-25 announcement](https://blog.colosseum.com/announcing-the-winners-of-the-solana-frontier-hackathon/). No source code was reused. MIT, Copyright (c) 2026 Nivesh Gajengi.
