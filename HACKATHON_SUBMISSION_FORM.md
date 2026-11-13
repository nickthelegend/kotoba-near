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
| idea | Bet on what they will say. Kotoba is a mention prediction market on NEAR testnet, with five word outcomes for December's FOMC press conference. Users place escrowed YES/NO limit orders, match by price and arrival time, sell before the event and cancel resting orders. The app reads real order-book depth, fills, price history, positions and trade-based P&L. Demo accounts seed the small book; it is not customer volume. Official Fed transcripts settle whole-word matches, including reporters. A hash-pinned OutLayer program runs in a TEE; the browser checks five evidence bindings and the SDK checks Intel signatures. The contract trusts OutLayer's callback. Previous-contract evidence includes a challenge rerun, verified September result and payouts. V3 has a separate deployed contract; both October judge replays remain untouched. Honest limits: local testnet demo, public bets, upgrade authority, nonrefundable order storage fee; human Meteor approval remains manual.<br>Character count: **972** (idea text only). |
| consent | Nick ticks after agreeing: "I agree that the organizers may use these details to review our submission and contact us about this hackathon." |

Before submitting, Nick fills the team disclosure and required fields, publishes the repo, and posts the demo video. Attach `kotoba-near-film-share.mp4`; publication and the X post URL remain TBD. The new film uses the new book; historic settlement context is dated.

## X post draft

The human posts this and attaches the video. Text length: **215 characters**.

```text
bet on what they'll say. kotoba is mention markets on NEAR: real limit orders, fills, selling and canceling, with a transcript count you can check. built at NEAR HACKATHON @NEARProtocol #NEARHackathon. testnet demo.
```

attach: kotoba-near-film-share.mp4
