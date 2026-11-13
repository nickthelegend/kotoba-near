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
| idea | Bet on what they'll say. Kotoba is a mention prediction market on NEAR: every word a speaker might say is its own Yes/No market. Live on testnet: "What will Warsh say?", 17 words across the December 9 and January 27 Fed press conferences. Each word has a real on-chain order book: limit and market orders, price-time priority, and Polymarket-style matching where two bids that add to 100¢ mint a backed YES/NO pair and two asks merge one, so Yes + No always sum to 100. Traders can sell before the event, cancel, and track positions and P&L. After the conference, a hash-pinned program counts the word in the official Fed transcript inside an OutLayer TEE; one bonded challenge reruns it, and the browser re-checks the seal. Honest limits: testnet, books seeded by Kotoba's demo makers, whole-transcript counting (reporters included), upgradeable unaudited code.<br>Character count: **862** (idea text only). |
| consent | Nick ticks after agreeing: "I agree that the organizers may use these details to review our submission and contact us about this hackathon." |

Before submitting, Nick fills the team disclosure and required fields, publishes the repo, and posts the demo video. Attach `kotoba-near-film-share.mp4`; publication and the X post URL remain TBD. The v5 film records four live trades on kotoba-markets.testnet, each approved on camera and then shown on the explorer; the settled-market seal it shows is dated January 28, 2026.

## X post draft

The human posts this and attaches the video. Text length: **221 characters**.

```text
what will the Fed chair say on Dec 9? kotoba turns every word into a Yes/No market with a real on-chain order book, settled by a sealed transcript count. built at NEAR HACKATHON @NEARProtocol #NEARHackathon. testnet demo.
```

attach: kotoba-near-film-share.mp4
