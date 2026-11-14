# NEAR HACKATHON submission worksheet

Draft for Nick to complete and confirm. Field names match the [official form and rules](https://nearhackathon.com/HACKATHON.md). Deadline: November 14, 2026 at 23:59 UTC. This worksheet does not submit anything.

| Field | Value |
| --- | --- |
| projectName | Kotoba |
| leadName | TBD Nick (2-80 characters) |
| email | TBD Nick (valid email, max 160 characters; max 2 submissions per email) |
| size | TBD Nick: one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+` |
| tracks | Proposed, best first: `open` - word prediction markets with a verifiable public-transcript oracle.<br>`privacy` - secondary proposal for hash-pinned transcript counting inside an OutLayer TEE, with verifiable execution; bets and transcripts are public, not confidential. Nick confirms the final array. |
| nearAddress | TBD Nick: NEAR MAINNET payout account (2-64 characters, lowercase named or 64-character implicit account; not the testnet contract) |
| projectUrl | TBD: public GitHub repo URL after push (max 300 characters) |
| demoUrl | TBD: the public X post URL (max 300 characters) |
| idea | Bet on what they'll say. Kotoba is a mention prediction market on NEAR: every word a speaker might say is its own Yes/No market, with a real on-chain order book. What it does better: Polymarket settles these markets with a bonded proposal and, on a second dispute, a vote of UMA token holders. Kalshi decides them itself, and a three-member committee rules on contested outcomes. Kotoba settles them with a program you can check. A hash-pinned counter reads the official Fed transcript inside an Intel TDX enclave (OutLayer), and your browser re-checks the seal. Anyone can bond 0.1 NEAR to rerun it; if the count changes, the challenger wins both bonds. The rule is fixed before trading. Escrow is non-custodial. Live on testnet: 17 Warsh words for the Dec 9 and Jan 27 press conferences. Limits: Fed transcripts only, testnet, demo makers seed the books.<br>Character count: **856** (idea text only). |
| consent | Nick ticks after agreeing: "I agree that the organizers may use these details to review our submission and contact us about this hackathon." |

Before submitting, Nick fills the team disclosure and required fields, publishes the repo, and posts the demo video. Attach `kotoba-near-film-share.mp4` (v7, 5:04). Publication and the X post URL are still TBD.

The v7 film opens with four live trades on kotoba-markets.testnet, each approved on camera and then shown on the explorer. At 0:26 it covers who decides the result on Kotoba versus Polymarket and Kalshi, with sources in docs/POSITIONING.md. It then walks through the full January 28, 2026 settlement, recorded on November 9 and re-verified live in the browser: the transcript, the sealed count, the challenge re-run and the payout on the explorer. A live settlement on November 14 was not possible because OutLayer failed contract-routed runs (see BLOCKED.md item 0).

## X post draft

The human posts this and attaches the video. Text length: **221 characters**.

```text
what will the Fed chair say on Dec 9? kotoba turns every word into a Yes/No market with a real on-chain order book, settled by a sealed transcript count. built at NEAR HACKATHON @NEARProtocol #NEARHackathon. testnet demo.
```

attach: kotoba-near-film-share.mp4
