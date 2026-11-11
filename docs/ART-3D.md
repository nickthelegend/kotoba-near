# Kotoba 3D object kit

One object per image in the xoox.fun object style (studio light, rounded bevels), but Kotoba's own material, colours and
face. The approved art stays as it is: the coral duotone torn-paper stickers in the landing hero and the dark press-room
event photos. This kit adds objects to the feature cards, the how-it-works steps, the settlement and proof section,
and to the empty, error, setup and success states.

- **Material:** vintage vitreous enamelware: smooth, glossy porcelain enamel over softly pressed steel, like a retro
  enamel mug or kitchen tin, with a thin espresso-black rolled rim on the edges. No candy lacquer, no gold trim, no metal
  chrome, no silver.
- **Palette:** main Kotoba coral `#ff5a4e` (body), accent cream `#f7efe6` (panels, dials, inner surfaces), rim line
  espresso `#1d1a17`, warm peach rim light `#ffb3ab`. The YES token alone is the app's YES green `#3fae63`; the NO token
  is coral, as in the app's split bar.
- **Face:** Kotoba's mark, painted in espresso on a cream patch: two small closed, upward-curved smiling eye arcs and a
  tiny round open "o" mouth, as if mid-word. The quiet mic has calm closed downward arcs and a flat mouth. Only on the
  talking objects (microphone, speech bubble, transcript, enclave cube, wallet, quiet mic); the tokens, gavel, trophy,
  seal, magnifier, abacus, stopwatch, warning and logo mark carry none.
- **Background:** transparent (no ground shadow), square 1024x1024, so each object sits on the near-black landing and
  phone app and on the cream web app. On the dark surfaces a soft coral radial light sits behind each object.
- **Subjects:** retro broadcast microphone (hero, matching the hero sticker's mic), speech bubble holding one word tile,
  transcript scroll with one highlighted line, counting abacus, YES token (up arrow), NO token (down arrow), sealed
  enclave cube (the TEE), gavel on its block (settlement), magnifier over a page (checking), trophy (claimed winnings),
  sleeping microphone (empty states), warning triangle (errors, closed), seal rosette (verified attestation), stopwatch
  (time rules, bets closed), wallet (connect), app-icon tile (logo mark candidate).

Style line used in every prompt:

> Glossy vintage vitreous enamelware 3D render, like a retro enamel mug: smooth porcelain enamel over softly pressed
> steel, coral red #ff5a4e enamel body with cream #f7efe6 enamel details and a thin espresso-black #1d1a17 rolled rim on
> the edges, a soft warm peach #ffb3ab rim light, soft studio lighting, crisp glossy reflections, rounded bevelled edges,
> gentle toy-like proportions, centred single object, transparent background (no background, no ground shadow), square
> 1024x1024, no text, no letters, no numbers, no logos.

Face line (talking objects only):

> A tiny friendly face painted in espresso-black on a cream patch: two small closed upward-curved smiling eye arcs and a
> tiny round open "o" mouth, as if mid-word; no cheeks, no eyebrows.

## Files and where each object is used

`packages/web/public/art/3d/kotoba-3d-<subject>.webp`, 640 px wide, transparent, 33 to 76 KB each. The `Obj` component
in `src/ui.tsx` renders them at a fixed width and height with alt text, and floats them 4 px over 5.5 s unless
`prefers-reduced-motion` is set.

| Object | Used in |
|---|---|
| `mic` | Creators page header ("Open the market") |
| `bubble` | Landing, how it settles 01 "Pick a word, take a side"; You, "No shares yet" |
| `transcript` | Landing, how it settles 02 "A TEE reads the transcript"; market page, "Transcript not published yet" |
| `magnifier` | Landing, how it settles 03 "Anyone can check the seal"; market page, "Transcript text not pinned" |
| `cube` | Landing tech grid, "OutLayer TEE execution" |
| `abacus` | Landing tech grid, "Program pinned on FastFS"; market verdict while the TEE is counting |
| `yes` / `no` | Landing tech grid, "NEP-245 YES/NO shares" (yes); settled market verdict, by the on-chain outcome; buy confirmation in the bet sheet, by the side bought |
| `seal` | Landing tech grid, "Attestation you can re-check"; market page, "The seal" header |
| `stopwatch` | Landing tech grid, "Time rules on-chain"; market verdict when bets are closed and the result is pending |
| `wallet` | Landing tech grid, "Accounts"; You, "No wallet connected" |
| `gavel` | Resolved, "Nothing has settled yet" |
| `quiet` | Board empty states (phone and web), Creators "No creator markets yet", market page "No market called …" |
| `warning` | Every error state (default art for `State kind="error"`, including the render boundary); market verdict after the deadline with no result |
| `trophy` | Market page settle box after a confirmed claim ("Winnings claimed"); You, beside each claimable winning position |
| `logo` | Logo-mark candidate only; not wired in (the approved 言 mark stays) |
