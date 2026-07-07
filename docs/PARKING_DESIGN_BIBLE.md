# Parking App Premium Design Bible

**Feeling to build toward:** *a premium marketplace that feels effortless, trustworthy,
modern, human, simple, and local.*

Source principles, translated (not copied) for a parking marketplace:
- **Too Good To Go** — discovery over search, restrained urgency, calm confirmation, warm
  imperfect realism
- **Airbnb** — trust architecture, detail-page anatomy, photography discipline
- **Apple Maps** — visual quiet, one thing at a time, no chrome competing with content
- **Uber** — collapse-to-one-decision transaction flow

This doc is written for both humans and AI coding assistants working in this repo. Where a
rule maps to an existing token or file, the path is given — **use the existing token, don't
invent a new one.** Read `apps/mobile/MOBILE_UI_GUIDELINES.md` and `AGENTS.md` first; this
doc extends them.

Part A explains *why* TGTG-class apps feel premium and translates each principle. Part B
applies those principles to specific FreeSpace screens. Part C is the token/component
reference. Part D is the anti-pattern list and PR checklist.

---

## 0. Ground truth — what already exists

Don't reinvent these. Extend them.

| System | File |
|---|---|
| Color/spacing/radius/typography tokens | `apps/mobile/designTokens.ts` |
| Derived theme (colors, spacing, radius, textStyles, surfaces, buttons) | `apps/mobile/styles/theme.ts` |
| Motion constitution | `apps/mobile/styles/motion.ts` |
| Shared primitives | `apps/mobile/components/ui/*` |
| Map price pin | `apps/mobile/components/MapPricePin.tsx` |
| Map list card | `apps/mobile/components/MapBottomCard.tsx` |
| UI migration rules | `apps/mobile/MOBILE_UI_GUIDELINES.md` |

**Known debt (confirmed by audit, 2026-07-07):** at least 14 divergent `borderRadius` values
in live use (10–23px, plus 100) across screens, and 9 screens define local color constants
(`const GREEN = "#0a8050"` etc.) instead of importing `styles/theme.ts`. This is why the app
currently reads as disjointed rather than sharp — the token system is already correct, it's
just inconsistently applied. Any new screen work should migrate toward the tokens in Part C,
not add a 15th radius value.

---

# Part A — Design language

*Why TGTG-class apps feel premium, and what to take from each principle.*

### A1. Visual personality

**Why it feels friendly, not transactional:** TGTG's emotional register is *discovery and
relief* ("I found something good nearby") rather than *query and results* ("I searched a
catalog"). Four things create that:
1. Warm, real, occasionally-imperfect photography instead of stock/staged images.
2. Generous whitespace around each unit — a card breathes, it isn't packed edge-to-edge like
   a spreadsheet row.
3. Conversational copy ("spaces near you") rather than inventory language ("listings",
   "SKUs", "results (42)").
4. One calm accent colour used sparingly, so nothing on screen is visually shouting.

**Why it avoids feeling like a database:** it shows *one thing at a time* — a single selected
card, not a table. Raw counts and IDs are backend information and never surface to the user.
Quantity is *felt* (a map full of pins, or silence when there's plenty of supply) rather than
recited as a number everywhere.

**Apply to parking:** the map + one surfaced `MapBottomCard` *is* the discovery moment — keep
list view secondary (a sheet you can pull up, not the default). Say "A driveway near you", not
"Listing #4821". Reserve exact numbers (precise distance in metres, price to the cent) for the
moment of decision — the card and detail page — not for ambient browsing copy.

### A2. Information density

**Above the fold on TGTG's home screen:** essentially just location context + map/list with
1–2 visible cards. No dashboard of filters, stats, or promo banners competing for attention.

**What's hidden vs. prioritised:** photo, price, distance, and availability window are
immediate. Exact address, full amenity list, and host detail are one tap away, not on the
card. Hiding detail isn't obfuscation — it's sequencing: show what's needed to decide whether
to look further, reveal the rest when the user has expressed interest.

**Apply to parking:**
- Above the fold on Search = map + price pins + (at most) one selected-card sheet. Nothing
  else competes for that space.
- Detail info (full house rules, cancellation policy, exact access instructions) lives
  collapsed or below-the-fold on the detail page, expandable on demand.
- Host-facing management screens (`ListingsScreen.tsx`) are allowed a **higher** density
  budget than the driver-facing discovery surface — that's correct, not an inconsistency.
  Different audiences, different jobs. Don't try to make the host dashboard as airy as the
  map screen; do keep both internally consistent with the token system in Part C.

### A3. Layout rhythm

**Margins:** one horizontal page margin, everywhere (`spacing.screenX`, 24px). A screen using
16px and another using 20px is the single fastest way to make an app feel like separate
teams built it.

**Section spacing vs. element spacing:** the gap *within* a group of related things should be
roughly a third to a quarter of the gap *between* groups. That ratio — not borders — is what
makes grouping legible at a glance.

**Vertical rhythm:** every gap should be a multiple of the spacing scale (4px base unit).
No arbitrary one-off values like `marginTop: 13`.

**Grouping — combine vs. separate:**
- **Combine** when items answer the same question. Price + the "includes service fee"
  disclosure toggle are one "cost" idea — same card (already correct in
  `BookingSummaryScreen.tsx`).
- **Separate** into distinct cards when they're different concerns the user might act on
  independently — "Payment" vs. the cancellation reassurance block are correctly two separate
  blocks in the same file today.
- Within one card, separate sub-rows with **whitespace**, not hairline borders between every
  item — reserve borders for the edge of the card itself.

**Recommended spacing rules:**

| Context | Token | Value |
|---|---|---|
| Screen horizontal margin | `spacing.screenX` | 24 |
| Gap within a card (tight) | `spacing.xs`–`spacing.sm` | 8–12 |
| Card internal padding | `spacing.card` | 24 |
| Gap between cards in a list | `spacing.md` | 16 |
| Gap between distinct sections on a page | `spacing.section` | 48 |
| Gap at a major screen transition (top of a new flow step) | `spacing.hero` | 64 |

### A4. Shape language

**Corner radius philosophy:** soft enough to feel human and approachable, restrained enough
to still feel serious and premium — TGTG/Airbnb never go so round it feels "bubbly" or
gamified, because that undercuts trust for a money transaction.

**Radius must scale with element size.** A big card with an 8px radius reads as sharp and
corporate; a tiny chip with a 24px radius reads as an odd blob. The proportion between
element size and radius is what makes shape feel *planned* — mixing radii across similarly-
sized elements is what makes it feel unplanned (this app's current 14-value radius spread is
exactly that problem).

| Element class | Radius | Reasoning |
|---|---|---|
| Cards, sheets | `radius.card` / `radius.sheet` (24–32) | Large surface, large radius |
| Buttons (primary/secondary) | 14–16 | Rounded-rect, not a full pill — premium-but-serious, matches Uber/TGTG's primary CTA shape |
| Chips, tags, badges | `radius.pill` (999) | Full pill reserved for small, low-stakes elements — tags, filters, status badges |
| Inputs | 14–16 (match button family) | So the whole form reads as one language |
| Map markers | custom pill (`MapPricePin.tsx`) | Small, high-contrast, its own rules — see A5 |

**The personality this creates:** consistent, moderate rounding = considered, human, premium.
Sharp mixed with round = engineering-built, unpolished. Pills on *everything* (buttons
included) = toy-like, gamified, cheap.

### A5. Depth and surfaces

Decision rule — pick exactly one per element, not several stacked:

| Situation | Use | Don't |
|---|---|---|
| Card floating over a map or over other content it needs to visually lift off (bottom sheets, `MapBottomCard`, selected pin) | **Shadow** | Don't also add a heavy border — shadow alone communicates elevation |
| Card sitting on a plain, flat page background (nothing behind it) | **Border only** (1px hairline) | Don't add shadow — it becomes decorative noise. Some current screens (e.g. `ListingsScreen.tsx` cards on flat `#F8FAFC`) stack border *and* shadow when the border alone is already sufficient separation |
| Grouping a whole section without a container | **Background colour tint** (e.g. a soft brand-tinted panel) | Cheaper and calmer than bordering every sub-item inside it |
| **Any UI floating over the live map** (search pill, filter bar, floating buttons) | **Near-opaque fill (92%+) or blur/scrim, plus shadow** | **Never rely on light transparency (40–60% opacity) for legibility over a map** — map tiles vary wildly in colour and brightness, and a translucent white pill that looks great over a park tile disappears over a dark urban or water tile. `MapBottomCard`'s status badges already do this correctly (`rgba(255,255,255,0.92)`) — apply the same near-opaque rule to search bars and filter chips floating over the map, not just to pins |

**Blur specifically:** reserve for overlays on top of *known, fixed* backgrounds (a modal
scrim over the whole screen). Don't use it as the primary legibility strategy over a map —
opacity that high plus a map's unpredictable content underneath is a losing combination;
near-opaque fill is the safer default.

### A6. Typography hierarchy

**Keep to 3–4 real size steps**, not a ten-step scale. Big jumps between levels so hierarchy
reads instantly (e.g. 26 / 17 / 14, not 26 / 24 / 22 / 20 / 18 / 17 / 16 / 15 / 14 — too many
adjacent sizes flattens everything into "medium importance").

**Weight over size for close emphasis.** Two things that are almost-but-not-quite equally
important should usually differ in *weight*, not size — a `bodyStrong` at the same size as
`body` still reads as emphasised without disrupting rhythm.

**Line height:** generous for body copy (~1.4–1.5×) — it's what makes long text feel calm
instead of dense. Tighter for headings (~1.1–1.2×) so large display text doesn't look loose.

**Emphasis via colour, not just weight:** a secondary line in muted grey at the *same size* as
the primary line still reads as secondary — this does a lot of hierarchy work for free
(`textStyles.meta`, `colors.textMuted` already exist for this).

**Price is allowed to break the scale.** Price is the answer to the user's core question —
"can I afford this, is it worth it" — so it should be the loudest thing on a card or screen,
even louder than the title. This is the single most common thing amateur marketplace apps get
wrong: title and price at comparable weight, so nothing tells the eye where to land first.

| Role | Token | Size / weight |
|---|---|---|
| Page title | `textStyles.screenTitle` | 26 / ExtraBold |
| Card/major title | `textStyles.title` / `titleSmall` | 25 / 22 ExtraBold |
| Section header | `textStyles.sectionTitle` | 25 / ExtraBold |
| Body | `textStyles.body` | 17 / Regular |
| Emphasis body | `textStyles.bodyStrong` | 17 / SemiBold |
| Meta/secondary | `textStyles.meta` | 14 / Medium |
| Label (form/eyebrow) | `textStyles.label` | 15 / SemiBold, tracked |
| Button | `textStyles.button` | 16 / SemiBold |
| Price (detail page hero) | `textStyles.priceLarge` | 52 / ExtraBold |

**Gap to close:** there's no price size *between* `priceLarge` (52, detail page) and card body
text (~16.5, `MapBottomCard.tsx`). Add a `priceCard` textStyle at **28–30px ExtraBold** for
list/map card price so it's unmistakably the loudest thing on the card, not a peer of the
title.

### A7. Colour usage

**Background vs. surface:** a near-white *page* background with pure-white *cards* creates a
subtle depth cue with zero extra shadow work (`surface.page` `#FAFBFB` vs. `surface.card`
`#FFFFFF` — already the correct instinct, needs the consolidation from §0).

**Surfaces:** card = pure white. Muted card = a barely-there grey tint. Never a mid-grey
card — mid-grey reads as *disabled*, not *neutral*.

**Accent discipline:** one brand colour, appearing in roughly 10–20% of visible elements.
Squint-test a screen: coloured elements should be the clear minority against neutral
black/grey/white.

**Muted text:** never pure black for secondary text — always a stepped-down grey
(`text.secondary`/`soft`/`tertiary` already defined) so hierarchy reads without needing
bold or size changes everywhere.

**Contrast over maps — the most common amateur mistake:** floating UI (search bars, filter
chips, buttons) rendered as lightly-transparent white over a map looks fine over light tiles
and washes out over dark terrain, water, or dense urban tiles. Rule: **any floating control
over the map must guarantee its own contrast regardless of what's underneath** — near-opaque
fills (92%+), not 40–60% transparency. Reserve genuine transparency for overlays on top of
known, fixed backgrounds only.

| Role | Token | Value |
|---|---|---|
| Primary (brand) | `color.brand[600]` | `#0a8050` |
| Primary dark (selected/pressed) | `color.brand[900]` | `#0a4230` |
| Background (page) | `color.surface.page` | `#FAFBFB` |
| Surface (card) | `color.surface.card` | `#FFFFFF` |
| Surface muted | `color.surface.muted` | `#EDEFEF` |
| Accent soft (badges, icon chips) | `color.surface.accent` | `#edf7f2` |
| Border | `color.border.default` | `#C7CFCF` |
| Warning | `color.status.warning` | `#f59e0b` |
| Danger | `color.status.dangerStrong` | `#dc2626` |

**Discipline rule:** green is the *action/live* colour — primary CTA, "available now",
selected map pin. If a screen uses green for more than ~3 distinct jobs at once (status dot +
CTA + icon background + border + text link, all on one screen), green has become "default UI
colour" instead of a deliberate signal — pull one of those uses back to neutral.

### A8. Imagery

**Size & cropping:** fixed aspect ratio per context (4:3 or square for cards, wider for hero
carousels) — never let aspect ratio vary per listing, which produces a jagged, inconsistent
grid. Always centre-crop/cover; never letterbox with empty bars (a "fit" image with grey bars
reads as a bug, not a design choice).

**Rounded images:** the image's corner radius should have an obvious relationship to the
card's outer radius — either it bleeds fully to the card edge and shares the card's exact
clip, or it sits inset with margin and gets a smaller, deliberately-related radius. A random,
unrelated radius on the image (e.g. 8px image inside a 24px card with no visual logic) reads
as unplanned. `MapBottomCard.tsx`'s image already does this correctly (bleeds to the card's
own clip, no separate radius).

**Image/text relationship:** the image answers "what is this place"; the text answers "why
should I book it." Don't duplicate — no caption repeating the title that already appears as
text below it.

### A9. Micro-interactions

**Animate to communicate, not to decorate.** Reserve motion for transitions that tell the user
*what changed* — a card entering, a sheet rising, pins landing on a map. If removing an
animation wouldn't lose any information, it's decoration — cut it.

**One consistent physics app-wide.** Arrivals should feel the same weight everywhere
(`styles/motion.ts` already enforces this via a shared `spring`/`duration`/`easing` set) — or
the app feels stitched together from different modules.

**Feedback is immediate, before the network responds.** Every tap needs a cheap, instant
visual response (opacity/scale press state) independent of how long the actual request takes —
this is what makes an app feel responsive, regardless of real network speed.

**Loading states mirror the real layout.** Skeleton screens (`SkeletonBlock`/`usePulse`,
already the pattern here), never a generic spinner — a spinner tells the user nothing about
what's coming; a skeleton sets expectation and lets real content "snap into" a frame that was
already there.

**Confirmation is quiet, not loud.** The emotional peak of a booking should be calm certainty,
not celebration — a checkmark, a settle-in fade/scale, a colour shift. No confetti, no
mascots — parking a car isn't the same emotional register as "you won a discount game," and
over-celebrating a utility purchase reads as try-hard rather than premium.

### A10. Marketplace trust — before, during, after

**Before purchase:** trust comes from *realism* (real photos, real reviews or an honest "New"
state, transparent pricing with no fee sprung at the final step) and from *specificity*
(host-scoped facts — "hosts since 2024", a real response time — never platform-wide claims
like "10,000+ happy drivers" that can't be verified by the person reading them).

**During booking/payment:** trust comes from *recognisable, familiar chrome* (Apple Pay/Google
Pay marks, card network logos, a lock icon, "Powered by Stripe") and from the *absence of
surprises* — the price shown at review must be exactly the price charged, server-verified,
never client-trusted.

**After purchase:** trust comes from the booking snapshot being *immediately and stably
available* — address, access instructions, cancellation terms. The anxious moment right after
paying is "did this actually work, how do I get in" — answer that instantly on the
confirmation screen itself, don't make the user go hunting through a history tab.

---

# Part B — Screen systems

*Applying Part A to specific FreeSpace flows.*

### B1. Discovery experience

- **Presentation.** Nearby spaces are the default view — map centred on the user (or
  last-used location), pins already down, no empty "search now" state on cold open. Already
  correct (instant-open cache in `SearchScreen.tsx`, no auto-search on map move per
  `AGENTS.md`) — keep it.
- **Availability feels ambient, not fetched.** A pin is either a live price (available) or a
  quiet "Full" pill (`MapPricePin.tsx`) — never a spinner over the map "checking
  availability." Capacity is a fact of the listing for this time window, computed once per
  search.
- **Urgency without cheap.** The honest equivalent of TGTG's countdown is **real remaining
  capacity for a specific slot** — "1 space left today," sourced from the same capacity check
  the DB trigger (`check_booking_capacity`) already enforces. Never invent urgency — no fake
  viewer counts, no countdown gimmicks. If a listing has 5+ free slots, show nothing; silence
  is also a signal (plenty of supply, no pressure, still trustworthy).
- **Map/list interaction.** Map is primary; list is a sheet, not a separate tab. Selecting a
  pin surfaces `MapBottomCard` — one card at a time, never a full-screen list replacing the
  map (Uber/Airbnb pattern). A "show list" affordance can expand the sheet for scanning many
  results, but map context should never be fully replaced.

### B2. Cards — parking card design system

| Element | Rule | Token |
|---|---|---|
| Image | 1 real photo, fixed aspect, bleeds to card clip | `MapBottomCard.tsx` imageWrap |
| Price | Largest, boldest text on the card — bigger than title, not comparable | new `textStyles.priceCard` (A6) |
| Availability | One badge max: available (no badge, price shown) / "Full" (quiet, muted) | already correct |
| Distance | Secondary line, `textStyles.meta` weight | — |
| Rating | Only if `reviewCount > 0` — else omit or show "New," never a fake average | `ListingScreen.tsx:992` pattern |
| Trust | Host-scoped only (verified host, response time) — never platform-wide | — |
| Amenity badges | Max one row of icon-only chips, ≤3 visible | `FeatureChip` |
| Corner radius | One value for all cards | `radius.card` (24) |

Card hierarchy, loudest to quietest: **price → title/space type → distance + availability
(same line) → rating (if real) → amenity chips.**

Don't: stack more than one status badge, use more than one CTA-coloured element per card, or
add unverified "Popular"/"Trending" labels.

### B3. Location-first UX

- Chosen location persists across sessions (`search.mapRegion` in `AsyncStorage`) — never
  force re-entering an address on every open.
- Radius is implicit from the visible map viewport (`radiusKmForRegion`) rather than a slider
  the user must set as the primary control — keep manual radius inside the filter sheet.
- Nearby discovery — pins on cold open, not a text field asking "where do you want to park?"
- Map/list switching — one persistent bottom affordance, not a separate tab; switching feels
  like a sheet rising over the same map state, never a navigation/reload.

### B4. Detail page

1. **Hero image** — full-bleed photo carousel, real host photos, dot indicator, no captions
   over the image.
2. **Title + address line** — space type + street, not the raw DB title.
3. **Host trust block** — host name, "hosting since [year]," real response time, verified
   badge if real. No fabricated stats.
4. **Availability** — the time/date picker already committed to on search, editable inline.
   Sold-out slots shown, not hidden — proves the system is honest about capacity.
5. **Price** — single total, fee-inclusive, breakdown behind a disclosure toggle (bring the
   `BookingSummaryScreen.tsx` pattern up to the detail page preview).
6. **House rules / access** — icon + text rows, reusing `profileUi.tsx`'s icon-list pattern.
7. **Reviews** — real only, "New" state when empty.
8. **Map preview** — small static map card (pin only, no controls), opens full map on tap.
9. **Sticky booking CTA** — price + "Book" pinned to the bottom while scrolling.

### B5. Booking flow

Uber-style collapse to the fewest decisions:

1. **Time & vehicle** — confirm/edit window, vehicle details (skippable if on file).
2. **Review & pay** — one screen: large total, payment method, one "Book" button. No
   upsells, no cross-sell between price confirmation and payment.
3. **Confirmed** — calm confirmation, booking snapshot (address, access code, arrival
   instructions) visible immediately — the very next need after paying, shown first.

Failure paths (capacity 409, payment failure) always pair the error with one clear recovery
action (`paymentRecoveryAction` pattern already in `BookingSummaryScreen.tsx`) — never a bare
error with no next step.

---

# Part C — Token & component reference

### Components

| Component | Spec |
|---|---|
| Card | `radius.card` (24), 1px `colors.border`, `cardShadow` if floating / border-only if flat — see A5 |
| Button primary | `buttons.primary` — brand green fill, 14 radius, 52 height |
| Button secondary | `buttons.secondary` — neutral fill, bordered |
| Chip (amenity/filter) | `radius.pill`, icon-only for amenity chips, icon+label for filter chips |
| Map marker | `MapPricePin.tsx` — white/available, deep green/selected, muted/full |
| Bottom sheet | slide up via `motion.spring`, `radius.sheet` top corners only, drag handle, backdrop fade |
| Modal | reserve for true interruptions (payment sheet, blocking confirmations) — not for content that could be a sheet |
| Map-floating control | near-opaque fill (92%+) or blur/scrim + shadow — never light transparency (A5, A7) |

### Motion tokens

Use `apps/mobile/styles/motion.ts` — no locally-invented springs or durations.

| Moment | Token | Notes |
|---|---|---|
| Card/sheet arrival | `motion.spring` | standard arrival for cards, sheets, pills |
| Save/favourite pop | `motion.springPop` | celebration only — don't reuse elsewhere |
| Dismiss/fade-out | `motion.duration.fast` + `motion.easing.in` | |
| Fade-in/arrival | `motion.duration.standard` + `motion.easing.out` | |
| Map pins landing | `motion.duration.entrance` | staggered reveal, already implemented (`onAllPinsRevealed`) |
| Loading state | skeleton pulse (`usePulse`, `SkeletonBlock`) | never a spinner over content |
| Booking confirmation | fade/scale via `motion.spring` (existing `successOverlay`) | no confetti, no mascot |

---

# Part D — Anti-patterns & checklist

### What NOT to do

- **Fabricated trust signals.** Site-wide "10,000+ happy drivers," fake "X people booked this
  today," seeded reviews. If it isn't computed from real data, it doesn't ship.
- **Card badge stacking.** More than one badge per card reads as desperate, not premium.
- **Auto-searching on every map drag.** Trains the user to distrust the result count and
  burns battery/data. Already correctly banned here — don't reintroduce it.
- **Spinners over content.** Skeletons that mirror the real layout, always.
- **Washed-out floating UI over the map.** Light-transparency search bars/filter pills that
  disappear over dark map tiles — the most common tell of an amateur map-based app (A5, A7).
- **Ad hoc visual tokens per screen.** 14 different corner radii and 9 different local green
  hex values across screens (this app's current state) is the fastest way to read as
  "vibe-coded." Every PR touching UI should reduce that number, never add to it.
- **Urgency theater.** Countdown timers and low-stock badges that don't reflect real
  inventory — erodes trust the first time a user notices the "2 left" listing never sells out.
- **Checkout upsells.** A cross-sell or "protect your booking for +€2" step between price
  confirmation and payment.
- **Decorative animation.** Page transitions, mascots, confetti that exist to feel
  "delightful" rather than to confirm state.
- **Inconsistent empty states.** A cute illustration on one screen, bare "No results" text on
  another — empty states should share one visual language across every screen that has one
  (`HistoryScreen.tsx` / `FavoritesScreen.tsx` show the current correct pattern).
- **Title and price at comparable weight.** The single most common marketplace-app tell —
  nothing signals to the eye which number actually matters (A6).

### Checklist for any PR touching mobile UI

- [ ] No new hex colour literals — used a token from `designTokens.ts` / `styles/theme.ts`
- [ ] No new `borderRadius` value outside `radius.*`, and radius scales with element size (A4)
- [ ] No new shadow definition outside `cardShadow` / `floatingShadow` / `primaryButtonShadow`
- [ ] Shadow used only for genuinely floating elements; flat cards use border only (A5)
- [ ] Any control floating over the map uses near-opaque fill or blur, never light
      transparency (A5, A7)
- [ ] No `fontFamily` set directly — used `textStyles`
- [ ] Price, where present, is visually louder than the title, not a peer of it (A6)
- [ ] No spinner introduced where a skeleton would do
- [ ] No animation added outside `styles/motion.ts` tokens
- [ ] Any trust/urgency signal is computed from real data, not authored copy
- [ ] Card shows at most one status badge and one CTA-coloured element

---

# Part E — Visual calibration layer (added 2026-07-07)

Part A explains the principles; this part pins them to *observed* visual fact. Sources:
screenshots of the current production TGTG app (PageFlows captures, App Store marketing set),
the Martorelli Lab redesign boards, and the UX Planet checkout case study — supplied by the
maintainer 2026-07-07. Where an observation refines a Part A/C value, it's flagged
**Calibration:** — Part A rules stand unless a calibration line explicitly tightens them.

### E1. Where the calm actually comes from

The surprising observation: TGTG's home screen is **dense**. Each card carries a scarcity
badge, a heart, a logo avatar, a store name, a collection window, a rating, a distance, a
struck-through price and a final price — and the screen stacks two or three card rails. It
still reads calm because of four mechanical disciplines, none of which is "show less":

1. **Two-zone cards.** The image zone owns every overlay (badge top-left, heart top-right,
   logo+name bottom on a scrim). The text zone is a strict left-aligned fact column with
   price right-aligned. Nothing floats in between.
2. **Metadata miniaturisation.** Facts are kept, but rendered at 11–13px in muted grey.
   Density is absorbed by size+colour, not by deletion.
3. **One saturated colour.** Deep pine green does price, chips, CTA, active tab. The only
   other non-neutral is a mustard scarcity badge. Everything else is ink/grey/white.
4. **Whitespace instead of chrome.** Sections are a bold ~17px header + "See all" text link,
   separated by pure spacing. No boxed section containers, almost no visible shadows.

**Calibration:** FreeSpace screens should never fix "busy" by deleting facts — fix alignment,
shrink+mute the metadata, and count the saturated elements.

### E2. Card proportions and curvature — observed values

- List card image ≈ 16:10, text block ≈ 40% of card height below it.
- **Card radius in production TGTG is ~12–16 — visibly tighter than our `radius.card` (24).**
  The Martorelli boards go to ~16–20. Rounder than ~20 on a small/medium card starts reading
  "bubbly" at TGTG/Airbnb calibre.
- Cards separate by whitespace + (sometimes) a hairline. Shadows on list cards are absent or
  below-perception.

**Calibration:** for small/medium cards (list rows, map card, review tiles) target the
**16–20 band** (`MapBottomCard`'s 18 is the reference). Reserve `radius.card` (24) for large
hero surfaces and `radius.sheet` for sheets. Don't migrate flat list cards up to 24.

### E3. Shadow softness

Across every reference screenshot the shadow count per screen is 0–2: the sticky bottom bar
(usually a hairline instead), and at most one floating object. Depth is done by pure-white on
off-white plus hairlines. **Calibration: one hero shadow per screen.** A screen with 5+
shadow declarations is over-elevated regardless of how soft each one is (SearchScreen
currently declares 20).

### E4. Surface separation and tinted panels

- Detail pages are white-on-white: icon fact rows + full-width hairlines + spacing. No boxed
  cards for primary content (our ListingScreen already matches).
- Soft brand-tinted panels (TGTG's ~`#e7f3ec` ≈ our `accentSoft`) are reserved for
  *categorised content tiles* — "what you'll get" grids, impact stats — always with a
  line-art icon in brand-dark and a short bold label. Tint = content category, never
  decoration or emphasis.

### E5. Image treatment — the identity layer lives on the photo

Hero and card images carry the identity overlays: scarcity badge top-left, save control
top-right, circular logo/avatar with a white ring + name bottom-left over a darkening
gradient scrim. The text zone below never repeats what the image zone already said.
**Calibration:** when FreeSpace gets host avatars onto listing photos, they go *on the
image* with a scrim, not as a separate row duplicating the title.

### E6. Typography and price loudness — observed values

- Card title ~15–16 SemiBold; metadata 11–13 Regular muted; **price ~17–19 ExtraBold in
  brand-dark green, right-aligned** — loudest element via *weight + colour + position*, not
  raw size. The struck-through original price sits beside it, small/grey/strikethrough.
- Body copy emphasises numerals inline with bold ("**809 meals** saved"), never with colour.
- **Calibration:** price loudness is a three-lever effect (weight, colour, position). Our
  `priceCard` (28) is louder than TGTG production — acceptable for the single surfaced map
  card, but on dense multi-card lists 20–22 ExtraBold with brand-dark colour achieves
  calibre without shouting. Green-tinted price is a legitimate value cue in references;
  for parking (no discount story) keep price in ink — revisit only if we ever show
  street-parking comparison savings.
- TGTG's terms/legal line at checkout is ~11px with underlined links — tiny is correct for
  legal, nowhere else.

### E7. Scarcity badge — the one warm accent

TGTG's "X left" badge: small pill, warm mustard, dark text, image top-left, appears **only**
when stock is genuinely low; plentiful stock shows nothing. This is the only warm colour in
the browsing UI, which is exactly why it works. **Calibration:** FreeSpace's honest-urgency
signal (B1, "1 space left" from real capacity) should ship as a single small amber pill
(`status.warning` family) overlaid on the image/card top-left — never a second badge, never
red, absent by default.

### E8. Search and map chrome

- TGTG treats **location as a header** ("London ∨ · within 10 km") with a quiet bordered
  search field under it — search is a supporting tool, not the hero. Map/list is a
  segmented toggle; filter chips sit in one row beneath; every control over the map is
  fully opaque white.
- Apple Maps: floating chrome is bottom-anchored, blur/near-opaque, and disappears when a
  sheet takes over. One floating object at a time.
- Our single floating search card (location + times + filter in one surface, one shadow) is
  the Airbnb variant of the same idea — correct; the guardrail is that it stays the *only*
  elevated object while the map is visible (selected-pin card excepted).

### E9. Checkout sheet anatomy (observed, TGTG production)

White sheet, ~20–24 top radius, X close top-right, centred store name + collection window,
generous vertical centring, quantity stepper (muted minus / green plus), Total row, then in
strict order: **terms line (tiny) → full-width dark-green CTA (~52–56 high) → payment-network
marks row**. The payment marks under the CTA are load-bearing trust chrome, not footer
decoration. **Calibration:** keep our 14-radius rounded-rect CTA (A4 stands; TGTG's full
pill is their brand register, not a requirement of premium) — what must match is height
≥52, full-width, single accent, and the terms→CTA→marks ordering our BookingSummary already
follows.

### E10. Trust made visible (not asserted)

Observed trust devices, all computed: rating + count beside every mention of a score; a
distribution bar chart on the reviews screen; "top highlights" chips aggregated from review
tags ("Friendly staff", "Quick pickup"); past-purchase photos; impact tiles with real
numbers. Nothing says "trusted by thousands".
**Parking translations worth building (in priority order):**
1. Host block on the listing detail page — name, "Hosting since <year>", response time,
   photo count. (Currently absent entirely — the single biggest calibration gap.)
2. Post-booking review tags → top-3 highlight chips on the detail page ("Easy to find",
   "Access code worked", "Felt safe").
3. Review distribution bars on the reviews screen once counts justify it.

### E11. Two registers — marketing loud, product quiet
**[SUPERSEDED 2026-07-07 by `docs/FREESPACE_BRAND_REVAMP.md` §4.** The maintainer reviewed
the result of this rule and rejected it as too timid: brand energy (flooded green panels,
lowercase display headlines, doodle motifs) is now *required* on designated brand-moment
screens, while transactional screens stay calm. Follow the revamp spec's register map, not
the paragraph below.]

The App Store marketing set is loud: brand-green flood, cream frames, chunky lowercase
script ("save / reserve / collect / track"). The in-app product is quiet: white, ink, one
green. These are deliberately different registers. **Calibration:** never import marketing
energy (flooded green panels, display-type headlines, exclamation copy) into product
screens; never let product restraint make the marketing surfaces timid.

### E12. Ink discipline — one black

References use a single ink for all primary text. FreeSpace currently circulates four
near-blacks: the token `#101414` (`colors.text`) plus hardcoded `#111827`, `#0f172a` and
`#0B1220` on un-migrated screens. Different blacks per screen is invisible in isolation and
unmistakable in aggregate — it's a large share of why screens feel like different apps.
**Calibration: `colors.text` is the only ink.** Shadows may keep `#0f172a`/`#0B1220` as
shadow colours (invisible at 9–12% opacity); text and icons may not.
