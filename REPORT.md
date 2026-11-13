# Kotoba v4 — Claude pass, November 13, 2026

**Why v4.** Reviewing the Codex v3 work: its contract was sound (12/12 tests rerun, deployed code matched the build), but every screen, the film and the on-chain markets asked "What will Powell say?" for December 9, 2026. Kevin Warsh has given the Fed press conferences since June 2026 (the October 28 official transcript reads "Chairman Warsh's Press Conference"), so the core premise was wrong on camera. v3 also kept separate YES and NO books (Yes 66¢ + No 42¢ = 108), its web app was one minified 20 KB file, and its film opened mid-app with a top caption band and a "LIVE ·" bar on every scene. Its commits and evidence are kept and pushed.

**Contract** (`packages/book-contract`, deployed to `kotoba-markets.testnet`): one book per word; NO orders rest mirrored at 100 − price; two bids that add to ≥100¢ mint a backed pair, two asks merge one; price-then-time priority; IOC market orders; self-cross refused; operator-listed markets with an event id; resolution, challenge, claim and void unchanged. 12 unit tests (incl. a 2,500-step randomized solvency session) + 4 sandbox tests on the real WASM, all passing.

**Markets.** "What will Warsh say?" — 12 words for December 9 and 5 for the tentative January 27, 2027 conference, opening prices from the July/September/October transcripts, books seeded and traded on a timer by Kotoba's own maker accounts (disclosed everywhere).

**App** (`packages/web/src/pm`, readable components): landing (approved sticker hero + live board, how it works with the real book, the seal, FAQ), markets grid with resolved markets, event page (chance chart, word rows with Buy Yes/No, inline order book with Yes/No mirror, trade ticket with fill estimate), rules & resolution with the live seal check, portfolio (P&L, open orders, cancel, withdraw), activity. Mobile 390: stacked rows, bottom buy bar and sheet, tab bar. Public RPCs rate-limit this IP, so reads rotate across four endpoints.

**Film v4d** (`videos/kotoba-near/kotoba-near-film.mp4`, 2:26; share 720p 7.4 MB): landing → event → live 10-share fill by 0:13, then book, limit, explorer, portfolio + cancel, sell, activity, rules + seal, markets, landing close. Bottom subtitles only, no bands. Self-judged 9/10 (versions/v4/JUDGE-v4a…d). Five live takes; all their transactions are in `deployments/film-v4-2026-11-13.json`.

**Not done / limits:** no v4 market has settled; human Meteor approval not filmed; Kalshi/Polymarket blocked automated Chrome from this network; no hosting.

---

# Kotoba v3 — completed November 13, 2026

The new order-book contract is `kotoba-book-v3-20261113.testnet`. Five December word markets have real seeded trades and resting YES/NO orders. Trading supports cash/share escrow, price-time priority, partial fills, selling, cancellation, IOC refunds and callback-safe cash withdrawal. Current deployed code matches the built WASM. The old contract and both October judge replays were only read; both replays remain Open with no result.

The app now has event cards, word outcomes, actual price history, depth, Buy/Sell and Limit/Market controls, portfolio, P&L, open orders, activity and Rules with settlement evidence. Main routes are `/`, `/app`, `/event/powell-dec-9`, `/portfolio` and `/activity`; previous market links remain available. Mobile has Chart / Order book tabs and a Trade jump. Coral, Urbanist and microphone art remain. Independent UI review closed **SHIP** after contrast and mobile reachability fixes.

Verification: **57/57 tests**, **18/18** signed-out cases, **18/18** connected cases and **24/24** production cases at 1440, 390 and 375. Production hard refresh, Meteor's testnet/new-contract popup, and closed/blocked messages pass. Human sign-in/approval remains manual. Forced-flag production builds exclude the QA signer. Root test/build commands include the book contract. `pnpm dev` uses port 5571. `test:e2e` defaults to read-only; its explicit `--send` mode is for future tests, not regenerating completed film actions.

Film outputs are `kotoba-near-film.mp4` (1080p, 169.291 seconds) and `kotoba-near-film-share.mp4` (720p, 169.301 seconds, 4.24 MB). Production files and reviews are in the external `videos/kotoba-near/versions/v3/` folder; v1/v2 exports are preserved. The film opens on the actual market and book. The buy reaches FINAL and moves 62% to 66% by 7–8 seconds. It then shows a sell, portfolio, resting order and cancel, four new explorers, activity, dated historical proof/payout, a limits card and close. Independent render scores were **8.7 → 9.0 → 9.2/10**; this is not Nick's acceptance. Full/share contact sheets and focus frames were inspected. Product-only freeze and silence scans pass; peak audio is −1.5 dB. Voice is bm_george with original quiet music. Raw WebMs were deleted after final QA; encoded cuts remain.

The four app-signed FINAL hashes and exact spend, **0.0173925160301097 testnet NEAR**, are in `deployments/film-v3-2026-11-13.json`. No live transaction was repeated after interruption. Read-only finishing and QA spent nothing. Final reserved-market state is recorded in `deployments/v3-final-readback-2026-11-13.json`.

Safer choices and limits: a fresh Kotoba-owned helper-faucet account funded the new deployment because the old account could not cover duplicate code storage. No old or other-project account was debited. Keep the proven pinned counter and disclose its whole-transcript scope, including reporters; do not claim speaker isolation. Historical settlement does not establish December or new-book settlement. Bets are public, depth is seeded, the code is upgradeable and unaudited, and each order retains a 0.005 NEAR storage fee. The prototype caps lifetime history at 4,096 orders and 8,192 fills. Prices use 100¢ per 0.001 NEAR winning-share payout, not dollars. Mainnet, gasless trading and human Meteor approval are not demonstrated.

Kalshi/Polymarket reference loads failed with SSL errors; failed attempts were saved, and Manifold/local picks were inspected. Public receipt rate limits were fixed by preferring archival RPC; the complete suite rerun passed. Source-video timing drift and light-card caption contrast were corrected without new trades. No hosting, push or key deletion was performed.

README, FLOW-QA, TESTING, HACKATHON_SUBMISSION_FORM and the shared submission index are refreshed. Tracks remain `open` then `privacy`; the idea is 972 characters and the X draft is 215. The external index is outside this product repo. The original report below is historical previous-version evidence.

---

# Kotoba build report — 2026-11-09 (Claude pass)

**Status: live on NEAR testnet.** One past FOMC press conference was settled end to end through real OutLayer TEE executions, and every attestation verifies. Four live markets are open for the Dec 9, 2026 FOMC press conference. See TESTING.md for the later UI rebuild and Meteor Wallet QA; full Meteor sign-in and approval still need human verification.

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
  - The later November 9 rebuild uses the news-markets layout described in TESTING.md.
  - Pages:
    - landing with live figures and the tx ledger;
    - board with countdown, odds and the bet sheet (live `quote`, Meteor Wallet `buy`; replaced MyNearWallet on November 10);
    - resolution page with hashes, both seals re-checked in the browser, and the transcript with 40 marked hits plus a navigator;
    - creators page with a market composer.
- **Tests.** The November 9 suites contain 28 tests: 3 oracle, 5 contract unit, 1 sandbox, 17 SDK, 2 MCP. The earlier total of 33 was an arithmetic error; November 10 added 14 web tests, bringing the source inventory to 42. See TESTING.md for recorded results. Five of them hit the live deployment and OutLayer's API.

What is still blocked: [BLOCKED.md](BLOCKED.md). This covers email/NEP-366, 1Click (it needs `NEAR_MAINNET_ACCOUNT`), NEP-141 collateral, per-market sub-accounts, creator transcript sources, and the submission video and post.
