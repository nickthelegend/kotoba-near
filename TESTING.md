# Verification — 2026-11-09

`pnpm test` from the repository root: **33 passed, 0 failed, 0 skipped**. It builds both WASM files first.

| Suite | Tests | What ran |
| --- | ---: | --- |
| Oracle (Rust) | 3 | The whole-word rule, the official URL allowlist, and the pinned real Fed PDF (hash `2c2683d9…5cd3`: 40 `inflation`, 0 `recession`). |
| Contract unit (Rust) | 5 | LMSR prices sum to 1, complete-set cost, monotonic cost, no risk-free complete set, finite extreme prices. |
| Contract sandbox (near-workspaces, real local nearcore) | 1 | Signed transactions against the real contract WASM. It covers market creation, a buy with the creator fee, NEP-245 transfer and transfer-call refund, and void-market refund at half a unit (once). It also rejects a bad source URL, a double-spaced phrase, unauthorized transfer, an underfunded buy, a direct call to the private callback, a premature claim, early resolution, a challenge before any result, a late buy, a void claim before the deadline, a double void claim, and resolution after the deadline. |
| SDK (Node) | 17 | Pricing, the phrase rule, fixture hashes, a live official PDF fetch and calendar parse, and a live OutLayer cost view. **Live deployment tests:** the recorded resolution re-verifies (all six attestation checks, Intel chain via dcap-qvl); a tampered output (`count` 39) fails the output-hash check; a changed program hash changes the task hash; the deployed contract holds the settled Jan 28 markets (Final, 40, transcript hash, program hash; recession 0). |
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

We ran `vite build`, then `vite preview` on port 5198, and drove headless Chrome (playwright-core, channel `chrome`).

| Route | 1440×900 | 390×844 |
| --- | --- | --- |
| `/` | no overflow, 0 page errors | no overflow, 0 page errors |
| `/app` | no overflow, 0 page errors | no overflow, 0 page errors |
| `/app` with the bet sheet open | live contract quote shown (0.0061 NEAR for 10 YES) | bottom sheet, same quote |
| `/market/fomc-2026-01-inflation-40` | 5 of 5 in-browser seal checks pass on both runs; browser count 40 = attested 40 | same |
| `/creators` | no overflow, 0 page errors | no overflow, 0 page errors |

During QA, FastNEAR returned HTTP 429 without CORS headers, so the web app now falls back to `rpc.testnet.near.org`. The preview server was stopped afterwards.
