# Why Kotoba: who decides what was said?

Mention markets ask "Will the speaker say *X*?". The hard part is deciding the answer. Today the big venues settle these markets with people: Polymarket uses a bonded proposal and a token-holder vote, and Kalshi decides itself and uses a committee for contested outcomes. Kotoba settles them with a program: a pinned counter reads the official transcript inside an Intel TDX enclave, and anyone can check the result or pay to rerun it.

Every claim below links to the page it came from. Pages were read on November 14, 2026.

## How Polymarket settles mention markets

- **Who decides.** Polymarket markets use "the UMA Optimistic Oracle for decentralized, permissionless resolution". Anyone can propose an outcome by "posting a bond (typically $750 pUSD)". A "2-hour challenge period" follows. Source: [docs.polymarket.com/concepts/resolution](https://docs.polymarket.com/concepts/resolution).
- **Disputes.** After the first dispute, "a new proposal round begins". If the second proposal is also disputed, "the resolution escalates to UMA's DVM (Data Verification Mechanism) for a token holder vote". The vote "takes approximately 48 hours". A disputed resolution takes "4-6 days total". Same page.
- **The vote.** UMA voting uses a commit period, then a reveal period, and needs a minimum "65% majority of staked UMA". Source: [docs.uma.xyz: how UMA's oracle works](https://docs.uma.xyz/protocol-overview/how-does-umas-oracle-work).
- **Rules can be clarified mid-market.** Polymarket "may issue an 'Additional context' update" when rules need clarification after trading starts. Source: [docs.polymarket.com/concepts/resolution](https://docs.polymarket.com/concepts/resolution).
- **Example rules.** "Will Powell say 'Inflation' 40+ times during June Press Conference?" (June 18, 2025):
  - Plurals and possessives count.
  - Closed compounds count: "killjoy" counts for "joy".
  - The resolution source is "video and transcripts of the FOMC Press conference".

  Source: the [Polymarket API record](https://gamma-api.polymarket.com/events?slug=what-will-powell-say-during-june-press-conference).

## How Kalshi settles mention markets

- **Contract terms.** These are from Kalshi's mention contract template, [MENTION.pdf](https://kalshi-public-docs.s3.amazonaws.com/contract_terms/MENTION.pdf):
  - Plural and possessive forms count. Closed compounds do not: "'fire' → 'wildfire' does not count".
  - Muted words do not count unless "an official uncensored recording or transcript" confirms them.
  - Captions that are not spoken do not count.
  - Before settlement, "Kalshi may, at its sole discretion, initiate the Market Outcome Review Process".
- **Who decides contested outcomes.** The KalshiEX Rulebook (v1.15, January 17, 2025, [PDF](https://cdn.robinhood.com/assets/robinhood/legal/KalshiEX_LLC_Rulebook.pdf)) sets this out:
  - Rule 2.7(e): the Outcome Review Committee is "a standing committee consisting of three members". At least two of the members must be Public Directors.
  - Rule 7.1(b): it decides "within a 24 hour period".
  - Rule 7.1(c): "The determinations made by the Outcome Review Committee are final."
  - Rule 7.2(a): Kalshi can "designate a new Source Agency and Underlying for that Contract and … change any associated contract specifications after the first day of trading".

  The two venues count words differently: Polymarket counts closed compounds and Kalshi does not. People read and apply these written rules.

## Real contested resolutions

We list only cases we could check ourselves.

1. **Kalshi, Melania Trump mention market (January 2026).** The live stream was muted for its first 30 seconds. Kalshi's rule for that event was "the live broadcast or stream will be used to resolve this event". So "Zoom" and "education" settled **No**, although both words can be heard in the full recording on YouTube. About $521,818 was traded. A trader holding both words called the settlement a "scandal" and said they would file a CFTC complaint. Source: [CasinoBeats, Jan 22 2026](https://casinobeats.com/2026/01/22/muted-melania-trump-causes-trouble-kalshi-mention-market-backers/).
2. **Polymarket, "Will Trump say 'Iran' during events with Xi Jinping?" (May 14–15, 2026).** Polymarket's own record shows the resolution status went `proposed, disputed, proposed, disputed, proposed, disputed`: three disputes. The market closed on May 23, 2026 at Yes 0 / No 1. Its rules count only "remarks which are broadcast or streamed live". Source: [Polymarket API record](https://gamma-api.polymarket.com/events?slug=what-will-trump-say-during-bilateral-events-with-xi-jinping). A bettor's blog ([reticulating.substack.com](https://reticulating.substack.com/p/polymarket-isnt-a-prediction-market)) gives an account of the votes that we could not match to the API, so we don't rely on it.

Context from other market types:

- **Ukraine minerals deal (March 2025).** A market of about $7M resolved Yes without a signed deal, after a large UMA holder was accused of swinging the vote. Polymarket called it "unprecedented" and gave no refunds. Source: [The Block](https://www.theblock.co/post/348171/polymarket-says-governance-attack-by-uma-whale-to-hijack-a-bets-resolution-is-unprecedented).
- **Zelensky suit (July 2025).** UMA voters resolved No. Source: [CoinGape, Jul 8 2025](https://coingape.com/polymarket-faces-controversy-over-a-bet-on-whether-zelenskyy-will-wear-a-suit/).

## What Kotoba does differently (all true in this repository)

| | Kotoba | Where to check |
| --- | --- | --- |
| **Who decides** | A pinned, open counting program (`packages/oracle`, WASM SHA-256 `b46b08da…2314`) downloads the official Federal Reserve PDF, hashes it and counts whole-word matches inside an Intel TDX enclave on OutLayer. The contract only accepts a result from that program hash and source URL. | `packages/book-contract/src/lib.rs` `on_result`; `packages/oracle/src/main.rs` |
| **Verifiable in the browser** | The market page reruns five attestation checks live: WASM hash, input hash, output hash, report data, and measurements approved on chain. The Intel signature chain is checked by the SDK (`dcap-qvl`). The January transcript is highlighted word by word, and the browser's count is compared with the attested count (40 = 40). | `/market/fomc-2026-01-inflation-40`; `packages/sdk/scripts/verify-attestation.mjs` |
| **Anyone can challenge** | During the 15-minute window, anyone can bond 0.1 NEAR to rerun the same program. If the count or transcript hash changes, the challenger takes both bonds. The rerun is final, with no human override. | `challenge` and `on_result` in both contracts |
| **Rule fixed before trading** | The phrase, threshold and source URL are set when a market is listed. The program hash is set at contract init. The rule is code, so you can run it yourself. | `create_market`, `new` |
| **Real order book** | Every word has its own on-chain book on NEAR. Orders match by price, then time. A Yes bid and a No bid can mint a pair, and two asks can merge one. | `kotoba-markets.testnet` |
| **Non-custodial escrow** | Bids lock NEAR and asks lock shares in the contract. You can cancel, sell or withdraw yourself. | `place_order`, `cancel_order`, `withdraw` |

OutLayer confirms the execution model in its [README](https://raw.githubusercontent.com/out-layer/outlayer/main/README.md): a worker inside Intel TDX "fetches the WASM binary, checks its sha256 and executes it". Every execution "produces a TDX attestation quote whose signature chains to Intel's root certificate".

## Limits

- **One source type.** Kotoba only reads official Federal Reserve press-conference PDFs (`federalreserve.gov/mediacenter/files/FOMCpresconf*.pdf`). It cannot read video, live streams or other speakers yet.
- **The whole transcript counts.** That includes reporters' questions, not only the chair. Matches are whole words: "tariffs" does not count "tariff".
- **The transcript is the Fed's.** If the Fed edits its transcript, the count follows the published PDF and the hash records which version was counted.
- **A rerun checks the run, not the rule.** A challenge reruns the same program on the same source. It protects against a bad run, not against a rule you disagree with. That is why the rule is fixed and published before trading.
- **Testnet and upgradeable.** This is unaudited software on NEAR testnet, with no real money. The contract account keeps a full-access key to list markets and upgrade code. On mainnet, that key would have to be locked or governed.
- **Trust in Intel TDX and OutLayer.** You still trust Intel TDX and OutLayer's approved measurements, which are published on chain at `worker.outlayer.testnet`.
