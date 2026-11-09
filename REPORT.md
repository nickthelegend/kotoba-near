# Kotoba build report — 2026-11-09 (Claude pass)

**Status: live on NEAR testnet.** One past FOMC press conference was settled end to end through real OutLayer TEE executions, and every attestation verifies. Four live markets are open for the Dec 9, 2026 FOMC press conference. The premium UI is built and QA'd.

- **Contract fixes.**
  - The challenge window is now set at init. It is at least 10 minutes; this testnet deployment uses 15.
  - Added `claim_void`, which pays half a unit per share if nothing settles by the deadline. It is solvent because the escrow is at least max(yes, no).
  - OutLayer refuses mixed-case hashes, so init now requires a lowercase pin.
  - Added the `config()` view.
  - The OutLayer limits are now 50B instructions and 90 s. A real run uses 0.79B instructions.
- **Deployment.**
  - The oracle WASM is uploaded to FastFS through a native `__fastdata_fastfs` uploader (`upload-oracle.mjs`). The upload was checked by re-hashing the served bytes.
  - The factory is `kotoba-edfa2b47.testnet`.
- **Real run.** OutLayer requests #14913 (direct), #14918 (resolve), #14919 (challenge) and #14920 (resolve). Results: inflation 40 (YES, Final, paid); recession 0 (NO, finalized, paid). The live attack rejections are listed in TESTING.md.
- **Attestation verifier.** It covers the program hash, input hash, output hash, `report_data` against the task hash, approved measurements on `worker.outlayer.testnet`, and the Intel chain via dcap-qvl (UpToDate). It is available in the SDK, as the MCP tool `kotoba_verify_resolution`, and in the browser (the first five checks).
- **Live markets.** The scheduler opened recession, inflation, tariffs and employment for Dec 9 2026 from the official Fed calendar. Bets have been placed on three of them.
- **Web.**
  - Look: a night press room with cream transcript paper and signal red, in Urbanist and Space Mono.
  - Art: Nick's art is used full-bleed with faded edges.
  - Pages:
    - landing with live figures and the tx ledger;
    - board with countdown, odds and the bet sheet (live `quote`, MyNearWallet `buy`);
    - resolution page with hashes, both seals re-checked in the browser, and the transcript with 40 marked hits plus a navigator;
    - creators page with a market composer.
- **Tests.** 33 pass: 3 oracle, 5 contract unit, 1 sandbox, 17 SDK, 2 MCP. Five of them hit the live deployment and OutLayer's API.

What is still blocked: [BLOCKED.md](BLOCKED.md). This covers email/NEP-366, 1Click (it needs `NEAR_MAINNET_ACCOUNT`), NEP-141 collateral, per-market sub-accounts, creator transcript sources, and the submission video and post.
