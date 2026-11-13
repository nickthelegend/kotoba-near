---
name: Kotoba v3
description: Warm-paper mention markets with a compact prediction-market trading interface.
colors:
  coral: "#ff5a4e"
  paper: "#f7efe6"
  surface: "#fffdf9"
  ink: "#141210"
  operational-muted: "#65594e"
  divider: "#e4d9cf"
  yes-bg: "#e8f2e9"
  yes-ink: "#2d6b47"
  no-bg: "#fae5e1"
  no-ink: "#b04d42"
  proof-surface: "#1d1a17"
  proof-muted: "#c4b7a8"
  proof-link: "#ff9a8d"
typography:
  display:
    fontFamily: "Urbanist, system-ui, sans-serif"
    fontSize: "48px"
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: "-1.8px"
  headline:
    fontFamily: "Urbanist, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-1px"
  proof-label:
    fontFamily: "Space Mono, ui-monospace, monospace"
    fontSize: "11px"
    letterSpacing: "0.08em"
rounded:
  side-button: "6px"
  input: "7px"
  primary-button: "8px"
  selected-outcome: "9px"
  ticket: "12px"
  event-card: "13px"
  proof-card: "22px"
spacing:
  compact-gap: "9px"
  mobile-gap: "16px"
  column-gap: "24px"
components:
  button-primary:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.ink}"
    rounded: "{rounded.primary-button}"
    padding: "13px 18px"
  button-yes:
    backgroundColor: "{colors.yes-bg}"
    textColor: "{colors.yes-ink}"
    rounded: "{rounded.side-button}"
  button-no:
    backgroundColor: "{colors.no-bg}"
    textColor: "{colors.no-ink}"
    rounded: "{rounded.side-button}"
  ticket:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ticket}"
    padding: "17px"
---

# Design System: Kotoba

## Overview

Kotoba uses the prediction-market structure chosen by the user: compact navigation, an event feed, a multi-word event page, and an operating view of outcomes, analysis and trading. The visual identity remains coral, warm paper, near-black ink, Urbanist and the existing microphone artwork. The familiar market hierarchy carries the product; transcript evidence is available within Rules.

The current trading interface is light, compact and mostly flat. Large conversational event titles lead into aligned numeric rows, restrained side colors and a persistent desktop ticket. The preserved previous version retains its own screens; its dark settlement-proof component also appears inside the new Rules view.

**Key Characteristics:**

- Warm surfaces and dark, legible operational text.
- Coral brand and trade actions; green YES and muted red NO controls.
- Dense market information with tabular numerals and clear unit labels.
- Microphone imagery on the feed and microphone icons on event surfaces.

## Colors

### Primary

Coral identifies the brand mark, wallet and trade actions, selected event-tab underline, chart line and keyboard focus. It remains the single brand accent.

### Secondary

YES uses the pale green background and green ink; NO uses the pale red background and red ink. The same side colors distinguish bid and ask depth. These are trading semantics rather than competing brand colors.

### Neutral

Paper is the page canvas. The lighter surface holds navigation, event cards, selected outcome rows and the trade ticket. Ink carries primary information; operational-muted carries scope, units, fees, book labels and portfolio/activity annotations. Thin warm dividers organize rows and sections.

The inherited proof card uses proof-surface with light paper text, proof-muted metadata and light coral proof-link links. Preserve this local dark treatment when the proof appears on the light Rules page.

**The Surface Contrast Rule.** Essential small annotations use the operational foreground on paper; links inside dark proof cards use the local light-coral foreground.

## Typography

Urbanist is the trading interface's display and body family, with system sans-serif fallbacks. Space Mono remains in inherited proof labels, hashes and verification metadata. Trading numbers use tabular numerals for stable alignment.

- **Feed display:** large, tightly tracked Urbanist (650 weight), reducing to 33px on mobile.
- **Event headline:** strong Urbanist (700 weight), reducing to 29px on mobile.
- **Selected outcome:** 24px desktop / 23px mobile; the percentage beside it is larger (36px / 32px).
- **Outcome rows:** 17px word labels on desktop and 14px on mobile; book depth uses 14px figures and 11px column labels.
- **Controls and annotations:** compact Urbanist with weight distinguishing actions from supporting copy. Proof labels use spaced uppercase monospace.

## Layout

The desktop shell has a sticky 70px header and a 44px category strip. Header links expose Markets, Portfolio and Activity alongside word search and wallet connection. The feed has a centered 1240px maximum container and a single real event card, capped at 620px. The microphone art balances the short feed headline.

The event container is capped at 1500px with 4.5% horizontal padding. Its desktop grid has outcomes, selected chart/book, and a 290px trade ticket, separated by 24px gaps. At widths up to 1150px the grid compresses to 250px, a flexible center and a 260px ticket with 16px gaps. The ticket stays sticky below the header.

At 850px and below the interface becomes a single column: event title and scope, outcome rows, sticky Chart / Order book / Trade controls, the active analysis pane, then the full-width ticket. Mobile analysis defaults to Order book. Direct YES/NO actions select the word and side and scroll to the ticket; Trade jumps to the existing selection. The chart and book share the same space through tabs. The ticket is in document flow, with scroll offset below the sticky shell.

Mobile hides header search and desktop navigation, keeps wallet connection, and adds fixed bottom navigation for Markets, Portfolio and Activity. Main content and footer include bottom space for that navigation. Outcome rows retain the word, last-fill percentage and both side actions on one row. Portfolio positions wrap; trade tables retain their compact four-column structure.

## Elevation & Depth

The trading interface uses surface tone, borders and thin dividers for structure. The event card adds a subtle hover shadow (`0 7px 22px #3d25100d`) with a 0.2s transition. Market rows, charts and tickets remain flat. Sticky header, mobile tools and bottom navigation establish functional layers. Reduced-motion preferences remove transitions and smooth scrolling within the trading interface.

## Shapes

Controls have modest corners: side actions, fields, primary buttons and selected outcomes use the small radii in the frontmatter. The larger event and ticket surfaces remain compact rather than pill-shaped. The inherited proof card has a more generous radius. Depth is rendered as translucent rectangular bars behind aligned rows; chart marks are a coral line and small circular fill points.

## Components

### Navigation

The wordmark pairs a coral square containing 言 with the Kotoba name. A testnet label appears on desktop. The category strip shows Fed as active and labels other categories coming soon. The previous version remains a link. Event tabs use a coral underline; mobile analysis tabs use a dark filled active state, beside a coral Trade jump.

### Event card and outcome rows

The event card presents microphone icon, date, open status, title, a preview of four words and a footer with the actual market count and traded amount. The event view lists all five words. A selected outcome receives a light surface; each outcome has independent YES/NO actions with current ask prices. Last-fill percentages remain separate from executable ask controls.

### Chart and order book

The coral chart plots actual matched fills for the selected side, with subdued guides and date labels. The order book groups resting shares by price, separates asks and bids around the spread, and shows cumulative NEAR totals. Empty history and absent book sides use explicit text states. A small note identifies real resting orders seeded by demo accounts.

### Trade ticket

The light bordered ticket holds Buy/Sell tabs, a Limit/Market selector, word, YES/NO selection, shares and an optional limit-price field. Active sides have a visible colored border. Numeric inputs sit inside warm bordered fields with trailing units. Estimates, fillable quantity, cost or proceeds, payout and storage fee precede the full-width coral submit action. Validation is inline; unavailable actions are visibly disabled. Confirmed actions show a green receipt with a public link.

### Portfolio and activity

Portfolio uses a compact statistics row, divided position rows, open orders and personal trade history. Position annotations include bid marks and basis/P&L disclosure. Activity uses the same four-column word/side, price, shares and time table. Supporting labels use the darker operational foreground. Empty orders and trades remain explicit.

### Rules and settlement proof

Rules is a readable text column capped at 800px, with the official-source link, counting scope, trust explanation and trading rules. The prior September proof is an inherited dark card with checks, metadata and evidence links. Light type and light coral links remain legible against that dark surface.

### Focus and feedback

Keyboard focus uses a 2px coral outline with a 3px offset. Disabled buttons lower opacity and use the unavailable cursor. Read failures appear in an alert strip with a retry action; confirmed transaction receipts use a green status surface.

## Do's and Don'ts

- **Do** keep the chosen prediction-market hierarchy and retained microphone identity.
- **Do** align numeric rows, identify units and distinguish last fills from current asks.
- **Do** preserve local contrast on both warm paper and dark proof surfaces.
- **Do** keep mobile analysis tabs and ticket jumps reachable alongside bottom navigation.
- **Don't** replace missing fills, depth or account activity with decorative sample data.
- **Don't** style the prior proof as a December result or hide full-transcript scope behind the event title.
- **Don't** carry the old explanatory landing/sidebar layout into the current trading interface.
