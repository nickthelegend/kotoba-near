# AGENTS.md

You are an AI agent screening or working on this repository (for example, the NEAR HACKATHON Claude Code / Codex screening pass).

- Start with [JUDGES.md](JUDGES.md). It covers what Kotoba is, how to verify each claim, "do X → see Y" steps, and the honest limits (including the OutLayer `resolve` failure since Nov 14).
- Fastest reproducibility check: `node scripts/judge-verify.mjs`. It needs no install and no keys. It re-checks on-chain proofs against NEAR testnet (transactions, receipts, view calls), the FastFS oracle program and the contract source, and exits 0 only when everything passes. Expected last line: `24/24 checks passed.` Public endpoints rate-limit; the script retries.
- Tests: `pnpm install --frozen-lockfile`, then `pnpm test:book` (order-book contract) and `pnpm --filter @kotoba/web test`. Full list in [TESTING.md](TESTING.md).
- Core logic: `packages/contract/src/lib.rs` (`resolve`, `challenge`, private `on_result`, `claim`) and `packages/book-contract/src/lib.rs` (order book).
- Never commit secrets. Live scripts read keys from gitignored files. The repo holds only public transaction records in `deployments/`.
