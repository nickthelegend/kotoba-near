# Source and execution research (2026-11-09)

## OutLayer

OutLayer runs WASM in Intel TDX and supports a NEAR testnet `outlayer.testnet` contract. A caller sends `request_execution` with a SHA-256 pinned `WasmUrl` (or registered project), JSON `input_data`, resource limits and a NEAR deposit. The caller receives stdout through a promise callback. WASI Preview 2 is required for HTTPS; the guest's stdout must fit within 900 bytes. The callback alone does **not** include an Intel quote, so settlement must authenticate the promise result and retain a separately verifiable attestation record, rather than imply that parsing an `attestation` field verifies it cryptographically. The OutLayer worker key registration is verified by `worker.outlayer.testnet`, which checks Intel DCAP quotes and approved TDX measurements. Cost is dynamic; query `estimate_execution_cost` before a run. Source: [NEAR integration](https://app.outlayer.ai/docs/near-integration), [WASI guide](https://app.outlayer.ai/docs/wasi), [trust model](https://app.outlayer.ai/docs/trust-verification), [pricing](https://app.outlayer.ai/docs/pricing).

The on-chain interface uses a `Promise` to `outlayer.testnet` followed by a `#[private]` callback. OutLayer describes this as yield/resume in its overview, although its published Rust example uses a promise callback. The contract should enforce that callback is self-invoked, is currently pending, and receives exactly one successful promise result. A direct caller cannot manufacture a promise result. A hash-pinned WASM is essential: a URL alone could serve a different program later. A separate offline verification of the TDX attestation is still needed for a full proof, using [OutLayer's independent verifier](https://app.outlayer.ai/docs/trust-verification).

A real `estimate_execution_cost` view on `outlayer.testnet` returned `7001000000000000000000` yoctoNEAR (0.007001 NEAR) on 2026-11-09 for 10 billion maximum instructions, 256 MB, 60 seconds, and 200 input bytes. This is a live quote for the stated limits, not an execution or a guaranteed final charge. The SDK test repeats the query.

## Transcript sources

| Source | Finding | Decision |
| --- | --- | --- |
| [Federal Reserve FOMC calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) | Free public event dates; December 8–9, 2026 is the next scheduled meeting as of research date. Press conference pages link a transcript PDF when published. The calendar does not promise a fixed transcript publication time. | Use for the first event factory. Close before the press conference starts; allow several days for the PDF. |
| [Federal Reserve press conference transcript](https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260128.pdf) | Official free PDF; January 28, 2026 PDF is marked FINAL. The April 29, 2026 PDF is [marked PRELIMINARY](https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260429.pdf), so source revisions are real. | Pin the first fetched PDF hash and allow a challenge rerun after later revisions. The oracle's `lopdf` extraction is pinned by the WASM code hash; on this January PDF it counts 40 occurrences of “inflation” (Poppler `pdftotext` counts 41, demonstrating why the extraction algorithm must be part of the rule). |
| [FOMC meeting transcripts archive](https://www.federalreserve.gov/monetarypolicy/fomc_historical.htm) | Meeting transcripts are historical, released years later; they are different from the press conference transcript. | Never substitute these for a press conference result. |
| [White House briefings and statements](https://www.whitehouse.gov/briefings-statements/) | The official site has written statements, but a complete, predictable briefing transcript feed and publication SLA cannot be established. | Future source only. |
| [SEC Item 2.02 guidance](https://www.sec.gov/rules-regulations/staff-guidance/corporation-finance-interpretations/non-gaap-financial-measures) | An earnings release in an 8-K is not the full spoken call. The SEC describes cases where a transcript *can* satisfy disclosure, not a general requirement to publish all calls. | Future source only, per issuer after checking a reliable official transcript feed. |

## Verified on 2026-11-09 (live)

- **Upload.** `outlayer upload` writes the WASM to FastFS as a `__fastdata_fastfs` function call carrying Borsh `SimpleFastfs`/`PartialFastfs` args. The call is sent with 1 gas, so it fails by design, and the indexer reads the bytes from the arguments ([outlayer-cli upload.rs](https://github.com/out-layer/outlayer-cli/blob/main/src/commands/upload.rs)). Files over 1 MB are chunked. Our 1,064,688-byte oracle took 2 transactions. It is served at `https://test.fastfs.io/<sender>/outlayer.testnet/<sha256>.wasm`.
- **Return value.** `request_execution` returns `env::promise_return` of a yield promise, and `on_execution_response` returns the guest's JSON (`response_format: Json`) as raw bytes, or `null` on failure ([contract/src/execution.rs](https://github.com/out-layer/outlayer/blob/main/contract/src/execution.rs)). A calling contract's `.then` callback therefore sees the oracle JSON directly.
- **Attestation.** Each run is available at `https://testnet-api.outlayer.ai/attestations/by-tx/<tx>` (also `/by-request/<id>`). `report_data[0..32]` = SHA-256(task_type ‖ task_id i64 LE ‖ build_target ‖ wasm_hash ‖ input_hash ‖ output_hash ‖ block_height u64 LE ‖ caller ‖ timestamp i64 LE ‖ attached_usd) ([worker/src/tdx_attestation.rs](https://github.com/out-layer/outlayer/blob/main/worker/src/tdx_attestation.rs)). Measurements are approved via `is_measurements_approved` on `worker.outlayer.testnet`. The quote verifies with `@phala/dcap-qvl` against Phala PCCS collateral. We reproduced all of this for requests #14913, #14918, #14919 and #14920.
- **Cost.** A real run took 0.789B instructions and 1.7 to 1.8 s, and cost 0.00117 to 0.00127 NEAR. The rest of the deposit was refunded.

## What remains unverified

A program that receives transcript text from an untrusted caller would not meet this design. An official PDF must be fetched within the TEE, and exact PDF-to-text extraction must be reproducible. The existing research does not establish a stable timing SLA for White House or earnings call transcripts.

## Inspiration

[Mentioned](https://colosseum.com/arena/projects/explore/mentioned) and [Memetic Machines](https://colosseum.com/arena/projects/explore/memetic-machines-war-machine), listed in [Colosseum's Frontier 2026 top-25 announcement](https://blog.colosseum.com/announcing-the-winners-of-the-solana-frontier-hackathon/), motivated the word market and autonomous settlement direction. Their implementation details are not imported.
