# Kotoba build report — 2026-11-09

**Status: BLOCKED against the requested definition of done.** The local market and transcript pipeline works, but there is no public testnet deployment or OutLayer execution to claim as a completed settlement.

## What works live

- The SDK fetches the current official Federal Reserve calendar and January 28, 2026 press conference PDF over HTTPS, and reads a live compute-cost estimate from `outlayer.testnet`. The pinned PDF SHA-256 is `2c2683d9d1f08b06668c0cf3257918e68dd748ef7a804dd14094e6e2c3e35cd3`; the Rust oracle's deterministic extraction counts 40 whole-word `inflation` matches and zero `recession` matches.
- A real local nearcore sandbox deploys the actual contract WASM and executes signed market creation, share purchase, NEP-245 transfer, failed receiver refund, and on-chain attack rejections. The contract has seeded LMSR pricing and a programmed OutLayer request, challenge and payout path. The OutLayer path has not run live.
- The SDK plans four December 9 FOMC word markets from the live calendar. The read-only MCP server starts and exposes live RPC tools with an explicit setup state. The web landing page, market board, position preview, and hash-checked archive render in Chrome.

## Verification

`pnpm test`: **23 passed, 0 failed, 0 skipped** (3 oracle, 5 contract unit, 1 integrated nearcore sandbox, 13 SDK, 1 MCP). `pnpm build` passed. Built web app in headless Chrome: 1440px and 375px both had a nonempty root, zero uncaught page errors, and no horizontal overflow. No external service was replaced by a mock or stub.

## Blocked

The official NEAR testnet account helper returned HTTP 429 with a one-hour retry instruction. The generated key is held only in gitignored `.near-credentials/deployer.json`; the account was not created. A retry is pending. Nick can instead provide a funded `NEAR_TESTNET_ACCOUNT` and `NEAR_TESTNET_PRIVATE_KEY` through a gitignored `.env`. OutLayer upload, live TEE execution, independent attestation verification, real challenge/payout tests, and testnet explorer hashes depend on that account. The exact inputs and missing engineering are listed in [BLOCKED.md](BLOCKED.md).

Email sign-in, a NEP-366 relayer, per-market subaccount escrow, NEP-141 test collateral, creator transcript sources and fee sharing, and a funded mainnet `NEAR_MAINNET_ACCOUNT` for a 1Click dry quote are also missing. No mainnet swap or spend was attempted. This repository remains local and has no remote.

## Demo commands

From the repository root:

```sh
pnpm install
pnpm test
pnpm build
node packages/sdk/scripts/scheduler.mjs
pnpm dev
```

Open the printed Vite URL. The board will say `Setup required: VITE_NEAR_TESTNET_CONTRACT` until a real deployment is configured. Scroll to the pinned archive for the verifiable 40-hit word heatmap. For browser regression, run `pnpm --filter @kotoba/web exec vite preview --host 127.0.0.1 --port 4173` in another terminal and `node scripts/check-web.mjs` from the root, then stop the preview server.
