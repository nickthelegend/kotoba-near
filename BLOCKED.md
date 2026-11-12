# What is not done, and what unblocks it

The testnet deployment, the OutLayer TEE runs, attestation verification, the challenge re-run, payouts and the live Dec 9 markets are **done**. See the README. What remains:

Two October 28 replay markets are available for judges: `fomc-2026-10-inflation-replay` and `fomc-2026-10-employment-replay`. Each is one-shot, with resolution open until November 26, 00:00 UTC. Both were read back Open with no result after a separate September replay was resolved and finalized through the app. Fresh results now show live seal panels; the SDK verified all six checks on the proof. A funded resolver needs at least 0.421 testnet NEAR spendable. See the [R3 proof](deployments/judge-path-proof-2026-11-12.json) and README instructions. Human Meteor approval remains manual.

R3 verification completed 17 web tests, 17 SDK tests, 14 focused production checks and 75 full-route production cases at 1440 and 375. The full audit has zero failures; ordinary cases have clean diagnostics. The static build and SPA fallback are ready, but hosting has not been performed. Net R3 spend was 0.0030905025308085 testnet NEAR; the proof bond was returned.

1. **Email sign-in and gasless bets (NEP-366 meta transactions).** Not built. Unblocking needs an email identity provider (`EMAIL_AUTH_CLIENT_ID` and its secret) and a funded testnet relayer key (`RELAYER_TESTNET_PRIVATE_KEY`) with an allowlist. Until then, bets are signed with a NEAR testnet wallet (Meteor Wallet via wallet-selector; full sign-in and approval still need human verification).
2. **Bets from any chain via 1Click.** The SDK has a `dry: true` quote helper only. It needs a funded `NEAR_MAINNET_ACCOUNT` in a gitignored `.env` (`ONECLICK_JWT` is optional). NEAR Intents has no testnet, so a testnet market cannot be funded from it.
3. **Test NEP-141 collateral.** Not built. Markets escrow native testnet NEAR.
4. **Per-market escrow sub-accounts** (`<id>.kotoba-….testnet`). Not built. Escrow sits in the factory account. Only the demo player is a sub-account.
5. **Creator transcript sources** (podcasts, streams). Not built. The oracle allowlists federalreserve.gov press conference PDFs only. Creators can open Fed markets and earn the 1% fee.
6. **On-chain quote verification.** The contract trusts the OutLayer promise result, whose origin is enforced by the private callback. The TDX quote is verified off-chain (SDK, MCP and browser), not inside the contract.
7. **Testnet NEAR budget.** Demo balances are limited. Check spendable balance after the storage lock before each write, and keep judge-preparation spending within 0.3 testnet NEAR. Current public balance snapshots and transaction evidence belong in `deployments/`; historical figures are not a funding guarantee for a judge's wallet.
8. **Submission evidence.** The demo film (attached to the X post) is `kotoba-near-film.mp4`; the smaller upload copy is `kotoba-near-film-share.mp4` in the same directory. Public repo and X post URLs remain TBD. Nick publishes the repo, posts the video, fills [HACKATHON_SUBMISSION_FORM.md](HACKATHON_SUBMISSION_FORM.md) and names the other team project in the README. Nothing has been submitted.

9. **Contract upgrade authority.** The demo contract account keeps a [full-access key](https://docs.near.org/protocol/accounts-contracts/access-keys) to sign its market creations, so the operator can also redeploy its code; deleting the last access key would end operator signing and upgrades, while other accounts could still call the deployed contract. Key deletion remains a human decision and was not performed.

Screenshots were captured locally during QA and are not committed.
