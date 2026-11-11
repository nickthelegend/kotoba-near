# Browser flow QA — 2026-11-11

**PASS at 1440×900 and 375×812:** connect → quote → buy → final receipt → You → reload. Both buys were signed in the browser by the development-only QA signer and executed on real NEAR testnet. No RPC or contract response was mocked.

Contract: `kotoba-edfa2b47.testnet`. Funded demo account: `player.kotoba-edfa2b47.testnet`. Market: `fomc-2026-12-employment`.

| Step | Result at both widths | Evidence |
| --- | --- | --- |
| Connect | PASS with QA signer; no wallet popup | Connected account appears on You. |
| Quote and quantity validation | PASS | A live quote loads. `1.5` shares shows the whole-share error and disables Buy. |
| Insufficient balance | PASS, no signing or spend | `100000` shares shows the balance warning and disables Buy. |
| Buy 1 YES | PASS, real browser signature and transaction | The two hashes below reached `FINAL`, with successful transaction and receipt outcomes. RPC verification checks the signer, receiver, `buy` method and exact market/side/quantity. |
| Receipt | PASS | The sheet shows `Bought 1 YES` and the matching transaction link, after finality. |
| You / position | PASS | Desktop: 42 → 43 YES. Phone: 43 → 44 YES. Each remains correct after reload and matches a final RPC balance read. |
| Key handling | PASS for the checks run | Startup key removed from the page global after wallet initialization; no private key found in localStorage or sessionStorage. |
| Browser health | PASS | Zero page errors, no wallet popups and no horizontal document overflow. |
| Mainnet guards | PASS | A `.near` account and a mainnet RPC are refused before key parsing. |
| Production exclusion | PASS | Production build with `VITE_QA_SIGNER=1` still contains no QA signer module, module name or injection marker in any generated asset. |

## Transactions and budget

| Viewport | Buy | Transaction |
| --- | --- | --- |
| 1440 | 1 YES | [BdRN7SgeCzyMz6fyemKtvqQTQkVxDPqs3V8kKuSCYm6B](https://testnet.nearblocks.io/txns/BdRN7SgeCzyMz6fyemKtvqQTQkVxDPqs3V8kKuSCYm6B) |
| 375 | 1 YES | [3LqDsqbSCKpgH5Mg9dE8aGTG8zaiqDYaDHVnGMhcQure](https://testnet.nearblocks.io/txns/3LqDsqbSCKpgH5Mg9dE8aGTG8zaiqDYaDHVnGMhcQure) |

The account had **0.0870641997959487 NEAR spendable** before this run. Its total balance fell by **0.00263368737922 testnet NEAR**, including gas for both buys, below the **0.3 NEAR** cap. No other account was funded or debited. Two earlier test-harness locator failures sent no transactions; they remain in the public run history.

Public evidence: [deployments/qa-browser-2026-11-11.json](deployments/qa-browser-2026-11-11.json). Run with `pnpm test:e2e`; prerequisites and safeguards are in [TESTING.md](TESTING.md#qa-signer-browser-e2e-2026-11-11).

## Screenshots and design check

Files are under `/private/tmp/claude-501/-Volumes-Extreme-SSD-Projects-grokbot/0f121b7c-0081-4ec0-81a9-0ccb4f7f8b48/scratchpad/flow-qa/kotoba/qa-signer/`:

- Before: `before-1440.png`, `before-375.png`.
- After, production: `after-production-1440.png`, `after-production-375.png`.
- Real QA flow at each width: `connected-*.png`, `balance-block-*.png`, `receipt-*.png`, `position-*.png`.

The reviewed production screenshots preserve the approved appearance. No styles, fonts, layout or art changed. QA mode substitutes the wallet name in existing text. The phone receipt screenshot includes the existing confirmation toast over lower sheet content; the success text and transaction link remain readable. The earlier `failed-1440.png` is a harness-failure capture, not a passing result.

## Scope and remaining check

The buy flow no longer depends on automating human Meteor approval. **Manual check remaining:** a person must sign in and approve a transaction through Meteor Wallet to verify that external wallet's approval flow. The QA signer exercises the app's wallet-selector interface and real signing/finality path; it does not test Meteor's own site.

Market creation, resolution, challenge, finalize and claim were not newly exercised through this browser run. Settlement and claim evidence in the older deployment files remains historical evidence, not a PASS for these browser actions. The open December market cannot be settled early, and this run did not create a new settlement scenario.
