# NEAR HACKATHON submission worksheet

Draft for Nick to complete and confirm. Field names match the [official form and rules](https://nearhackathon.com/HACKATHON.md). Deadline: November 14, 2026 at 23:59 UTC. This worksheet does not submit anything.

| Field | Value |
| --- | --- |
| projectName | Kotoba |
| leadName | TBD Nick (2-80 characters) |
| email | TBD Nick (valid email, max 160 characters; max 2 submissions per email) |
| size | TBD Nick: one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+` |
| tracks | Proposed, best first: `open` - word prediction markets with a verifiable public-transcript oracle.<br>`defi` - LMSR-priced YES/NO shares, native NEAR escrow and contract payouts; no working cross-chain funding is claimed. Nick confirms the final array. |
| nearAddress | TBD Nick: NEAR MAINNET payout account (2-64 characters, lowercase named or 64-character implicit account; not the testnet contract) |
| projectUrl | TBD: public GitHub repo URL after push (max 300 characters) |
| demoUrl | TBD: the public X post URL (max 300 characters) |
| idea | Word bets need a result people can check: which transcript was used, how words were counted, and who gets paid. Kotoba is a prediction market for words in official Federal Reserve press conferences. Users buy YES or NO shares with native testnet NEAR. A NEAR contract holds escrow, issues NEP-245 shares and pays winning holders. It requests a hash-pinned OutLayer program that fetches the official PDF, records its hash and counts whole-word matches in a TEE. A bonded challenge reruns the same program. The SDK verifies TDX attestations off-chain; the contract trusts the OutLayer callback. Recorded testnet runs include resolution, a challenge and payouts. The web demo runs locally; full Meteor Wallet approval still needs human verification.<br>Character count: **746** (idea text only). |
| consent | Nick ticks after agreeing: "I agree that the organizers may use these details to review our submission and contact us about this hackathon." |

Before submitting, Nick must fill the README's other-project disclosure with the team's actual other project names (Q-015), publish the repository, and publish the demo post with a video. No completed video was found under `/Volumes/Extreme SSD/Projects/grokbot/videos/kotoba-near/`; the local-only demo requires one. Repository publication and the X post remain TBD. Submit this project only once.

## X post draft

The human posts this and attaches the video. Text length: **225 characters** (under 280; attachment note excluded).

```text
word bets need a checkable result. kotoba counts official Fed transcript words in an OutLayer TEE; NEAR testnet holds shares and pays winners. built at NEAR HACKATHON @NEARProtocol #NEARHackathon. which word would you bet on?
```

attach: video TBD
