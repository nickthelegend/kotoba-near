# What is not done, and what unblocks it

The testnet deployment, the OutLayer TEE runs, attestation verification, the challenge re-run, payouts and the live Dec 9 markets are **done**. See the README. What remains:

1. **Email sign-in and gasless bets (NEP-366 meta transactions).** Not built. Unblocking needs an email identity provider (`EMAIL_AUTH_CLIENT_ID` and its secret) and a funded testnet relayer key (`RELAYER_TESTNET_PRIVATE_KEY`) with an allowlist. Until then, bets are signed with a NEAR testnet wallet (Meteor Wallet via wallet-selector; full sign-in and approval still need human verification).
2. **Bets from any chain via 1Click.** The SDK has a `dry: true` quote helper only. It needs a funded `NEAR_MAINNET_ACCOUNT` in a gitignored `.env` (`ONECLICK_JWT` is optional). NEAR Intents has no testnet, so a testnet market cannot be funded from it.
3. **Test NEP-141 collateral.** Not built. Markets escrow native testnet NEAR.
4. **Per-market escrow sub-accounts** (`<id>.kotoba-….testnet`). Not built. Escrow sits in the factory account. Only the demo player is a sub-account.
5. **Creator transcript sources** (podcasts, streams). Not built. The oracle allowlists federalreserve.gov press conference PDFs only. Creators can open Fed markets and earn the 1% fee.
6. **On-chain quote verification.** The contract trusts the OutLayer promise result, whose origin is enforced by the private callback. The TDX quote is verified off-chain (SDK, MCP and browser), not inside the contract.
7. **Testnet NEAR budget.** Demo balances are limited. Check spendable balance after the storage lock before each write, and keep judge-preparation spending within 0.3 testnet NEAR. Current public balance snapshots and transaction evidence belong in `deployments/`; historical figures are not a funding guarantee for a judge's wallet.
8. **Submission evidence.** The demo film exists at `/Volumes/Extreme SSD/Projects/grokbot/videos/kotoba-near/kotoba-near-film.mp4`; the smaller upload copy is `kotoba-near-film-share.mp4` in the same directory. Public repo and X post URLs remain TBD. Nick publishes the repo, posts the video, fills [HACKATHON_SUBMISSION_FORM.md](HACKATHON_SUBMISSION_FORM.md) and names the other team project in the README. Nothing has been submitted.
