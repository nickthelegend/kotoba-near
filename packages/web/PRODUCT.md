# Mention-market trading

Inherits [the root product brief](../../PRODUCT.md). This document describes the implemented v3 web interface. Visual guidance lives in [DESIGN.md](../../DESIGN.md).

Kotoba is a NEAR testnet mention market: “Bet on what they'll say.” The interface follows the user-selected Kalshi/Polymarket-like market structure while retaining coral, warm paper, Urbanist, Space Mono in proof metadata, and microphone branding. The lead experience is browsing and trading; transcript counting and OutLayer evidence explain settlement within Rules.

## Current surfaces

- **Markets feed:** `/` and `/app` show the December 9, 2026 FOMC event, a four-word preview, actual traded amount and the count of five deployed word markets. The five outcomes are Tariff, Recession, Inflation, AI and Employment. Fed is active; earnings calls and debates are labeled coming soon. Demo-seeded testnet liquidity is explicit.
- **Event:** `/event/powell-dec-9` exposes all five outcomes, a selected-side chart and order book, and a Buy/Sell ticket with Limit/Market choices. Desktop shows outcomes, analysis and ticket in three columns. Mobile shows outcome rows, Chart / Order book tabs, a Trade jump and a full-width ticket. Direct YES/NO outcome actions select the side and jump to the mobile ticket.
- **Portfolio:** `/portfolio` requires a connected wallet to show available cash, held shares, open orders, bid-marked positions, supported P&L, personal trades, cancellation and cash withdrawal actions.
- **Activity:** `/activity` shows actual contract-recorded matches with word/side, price, shares and time.
- **Rules & resolution:** the event tab explains counting, official source, trust boundaries, trading rules and the prior September settlement proof. Existing legacy routes remain available, including the previous version and resolved-market page.

## Market and price truth

The v3 central limit order book is deployed separately from the preserved previous contract. The UI reads contract snapshots and refreshes every 12 seconds, as well as after confirmed actions. Displayed markets, depth, history, volume, balances and orders come from on-chain state. Demo liquidity is real on-chain activity seeded by demo accounts; it is not evidence of organic demand.

Outcome percentages prioritize the latest YES fill price, and the UI labels the column “Last fill %.” If no fill exists, the quote helper returns an absent-value dash; it does not turn a midpoint or resting quote into a trade. YES/NO buttons show current ask prices, which can differ from the displayed percentage. Charts use actual fills for the selected side. Books aggregate resting orders by price; absent asks, bids or history receive explicit empty states. No hypothetical quote or history replaces missing data.

Prices use normalized cents. A winning share pays 0.001 test NEAR, represented as 100¢; these cents are not USD. Testnet coins have no cash value.

## Trading behavior

The ticket supports buying or selling either side using limit or immediate market orders. Limit prices accept 1–99¢ and quantities accept 1–100,000 whole shares. The UI previews available matching depth, average fill price, immediately fillable shares, maximum cost or minimum proceeds, potential payout and the 0.005 test NEAR order storage fee. Insufficient held shares disable a sell and explain the available amount.

Limit orders match at the resting maker's price, using best price then oldest order; remaining quantity can rest in the book. Market orders use available depth only and return unfilled amounts. Self trades are skipped. Cash and shares are escrowed on chain. Resting orders can be canceled from Portfolio, and available cash can be withdrawn. Rules instruct users to cancel resting orders before claiming escrowed shares.

Wallet actions show a confirmation state and only display a final receipt after NEAR finality checks. Receipts link to the public transaction. Read or transaction failures are visible with a retry path. Wallet connection uses the existing Meteor wallet-selector interface; the test signer remains build-gated.

## Portfolio accounting

Held positions are marked at current executable bids, with an explicit missing-bid state. P&L uses matched trade cost and appears only when recorded trade quantities account for the current holding. Minted or transferred shares without allocated single-side basis show P&L unavailable. The disclosure states that storage and network fees are excluded. Personal fills and public Activity are contract history, not synthetic performance records.

## Resolution and evidence

A word resolves YES when it occurs at least once in the entire official December 9 transcript, using case-insensitive whole-word matching. The counter includes reporters' questions and does not isolate Powell's speech. This scope is stated beside the event title and repeated in Rules.

Rules links to the official Federal Reserve PDF and explains the pinned counting program running in OutLayer's protected computing environment. The browser checks evidence; Intel hardware signatures use a separate verifier, and the contract trusts OutLayer's callback. The operator retains upgrade authority.

The embedded proof is the September replay, recorded November 12, 2026, on the previous contract. It demonstrates that prior run and is labeled accordingly; it is not December settlement evidence. The previous resolved-market page and live seal remain accessible.

## Presentation boundaries

Keep only real deployed markets and observed account states visible. Empty orders, absent liquidity, unavailable basis and wallet-disconnected states are valid product states. Preserve testnet and seeded-demo disclosures, normalized-price units, storage fee and partial-fill explanation. Retain all old contracts and both reserved October replays. Do not introduce mainnet, USD value, gasless execution or speaker-isolated counting claims.
