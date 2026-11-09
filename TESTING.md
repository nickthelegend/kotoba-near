# Verification run — 2026-11-09

Command: `pnpm test` from the repository root. Result: **23 passed, 0 failed, 0 skipped**. The command builds both WASM artifacts first, then runs:

| Suite | Real tests | What ran |
| --- | ---: | --- |
| Oracle Rust | 3 | Whole-word rule, official URL allowlist, pinned real Fed PDF extraction and hash (40 `inflation`, 0 `recession`). |
| Contract Rust unit | 5 | LMSR prices sum to 1, complete-set cost, monotonicity, no risk-free complete set across imbalanced purchases, and finite prices at extreme share imbalance. |
| Contract near-workspaces sandbox | 1 | One integrated test using signed transactions against a real local nearcore sandbox. It created a market, bought shares, transferred NEP-245 shares, refunded a failed transfer-call, and rejected an oracle-incompatible URL, unauthorized transfer, underfunded buy, direct private callback, premature claim, early resolution, challenge before provisional result, and late buy. |
| SDK Node | 13 | Pricing, phrase rules, fixture hashes, live official Fed PDF fetch, live official Fed calendar parse, live OutLayer testnet compute-cost view, source-swap hash change, and setup guards. |
| MCP Node | 1 | Started a real MCP stdio server, listed tools and verified the explicit setup error. |

No chain or external service response was replaced in a test. The sandbox test deploys and calls the actual contract WASM. Its chain is ephemeral, so these transaction hashes cannot be independently queried after the test process exits; no public testnet hash is claimed.

Browser build command: `pnpm --filter @kotoba/web build`. Chrome verification command: run `pnpm --filter @kotoba/web exec vite preview --host 127.0.0.1 --port 4173` in one terminal, then `node scripts/check-web.mjs`. Built app results:

| Width | Root | Uncaught page errors | Horizontal overflow |
| ---: | --- | ---: | --- |
| 1440px | Nonempty | 0 | None |
| 375px | Nonempty | 0 | None |

The browser check also loaded the pinned archive text. The market sheet contains a live RPC quote preview when a deployed contract has an open market; no real market existed for that browser path in this run. The server and Chrome process were stopped after verification.

The independent source check `node packages/sdk/scripts/verify-transcript.mjs https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260128.pdf 2c2683d9d1f08b06668c0cf3257918e68dd748ef7a804dd14094e6e2c3e35cd3` fetched the official PDF live and confirmed the expected hash. It is a manual check in addition to the 23 test cases above.

**Not verified:** public testnet deployment, OutLayer upload/execution/attestation, challenge rerun via OutLayer, a winning payout and double-claim rejection on a live chain, email sign-in, 1Click quote with a funded mainnet account, and a live market result heatmap. These are recorded in [BLOCKED.md](BLOCKED.md). The official testnet account helper returned HTTP 429, so there is no testnet transaction or explorer link.
