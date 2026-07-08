# Visual gap analysis — FreeSpace mobile vs. the calibration standard

**Date:** 2026-07-07 · **Standard:** `docs/PARKING_DESIGN_BIBLE.md` Parts A–E (Part E added
same day from TGTG/Martorelli/UX-Planet reference screenshots).
**Method:** quantitative style fingerprint of all 16 customer/host screens + `MapBottomCard`
/ `MapPricePin` (hex literals, radius/fontSize distributions, shadow counts, theme adoption),
plus close reads of SearchScreen, ListingScreen, BookingSummaryScreen, HistoryScreen,
WelcomeScreen, MapBottomCard. Screens marked *(fingerprint only)* were ranked from the
quantitative sweep without a full render read.

**Point-in-time document.** When an issue is fixed, delete its row — the bible stays
evergreen; this file shrinks to zero.

---

## The verdict in one paragraph

The app's **anatomy is already at reference level** in the core funnel — the single floating
search card, one surfaced map card, full-bleed hero with parallax and photo dots, hairline-
separated white detail sections, honest reserve note, terms→CTA→payment-marks checkout
ordering. What sits between FreeSpace and TGTG/Airbnb calibre is almost entirely
**execution discipline**: four different blacks, ~30 distinct font sizes across the booking
funnel, 10–13 border radii per screen, 20 shadow declarations on one screen, and one genuine
anatomical hole — the listing page never says who the host is. A designer at that level
would change very few layouts; they would ruthlessly converge tokens and add the missing
trust layer.

---

## Systemic issues (fix once, every screen improves)

### S1 · CRITICAL — Four inks
`colors.text` is `#101414`, but SearchScreen/MapBottomCard/ListingScreen internals/Welcome
hardcode `#111827`, SearchScreen also uses `#0f172a` (as *text and fill*, e.g. selected
filter chips and histogram bars) and `#0B1220`. Adjacent screens in the same flow literally
render their titles in different blacks. *Reduces trust:* subliminal "different app per
screen" feeling. **Rule now in bible E12: one ink.**

### S2 · CRITICAL — Type scale fragmentation in the money funnel
Search (11 sizes, incl. 9.5/11.5/13.5/15.5) → Listing (**17 sizes**, 10.5→23) →
BookingSummary (13 sizes, 10→28). `textStyles` adoption in these three screens: 7 uses, 0, 0.
Fractional one-off sizes are the single strongest "developer-built" tell — no visible
rhythm, everything reads medium-important. *Hurts conversion:* hierarchy is what tells the
eye price → title → meta; 17 steps flattens it.

### S3 · HIGH — Radius sprawl (bible §0 debt, still open)
Per-screen distinct radii: ListingsScreen 13, HistoryScreen 10, ListingScreen 10,
SearchScreen 8. Values like 6, 9, 11, 17, 19, 23, 30, 36, 55, 100 all live outside
`radius.*`. Part E2 tightens the target: small/medium cards converge on 16–20 (18 is the
reference), 24 reserved for hero surfaces, pill for chips.

### S4 · HIGH — Over-elevation
SearchScreen: 20 shadow/elevation declarations. ListingScreen: 14. Reference screens carry
0–2. Half of these stack on bordered elements (double separation, bible A5). Rule now in
E3: one hero shadow per screen.

### S5 · MEDIUM — Theme adoption is bimodal
PaymentsScreen, WelcomeScreen, ReviewScreen import **nothing** from `styles/theme` — every
value hardcoded (Welcome/Payments happen to eyeball the brand; Review uses `#d1d5db` stars
that match no token). FavoritesScreen hardcodes `#0a8050` ×11 and slate greys from a
different palette. These screens will drift further with every edit until migrated.

---

## Screen-by-screen

Ordered by conversion impact, not severity count. "One lever" = the single change with the
biggest premium impact on that screen.

### 1. ListingScreen — the conversion page
**Level:** anatomy A-grade, execution C.
**One lever:** add the host block (E10.1) — name, "Hosting since <year>", response time.
A marketplace listing with no human behind it caps how much trust any polish can buy.

| Rank | Issue |
|---|---|
| **Critical** | No host identity anywhere on the page — no name, tenure, or responsiveness. Airbnb/TGTG both surface the counterparty before the CTA. Direct trust/conversion cost. |
| **High** | 17 font sizes, zero `textStyles`. Local semantic aliases (`FG`, `FG_2`…) are mapped to theme colours (good) but sizes are ad hoc per style. |
| **High** | 10 radius values (2, 3, 12, 16, 17, 18, 19, 20, 55, 999) on one screen. |
| **Medium** | Residual literals outside the alias block: `#EEF1F3` divider, `#D9DCE0` handle, `#edf7f2` green-soft, `#F7F9FA` review-tile fill, `#9AA4AD` chevrons — all have token equivalents. |
| **Medium** | No honest-scarcity signal ("1 space left" per E7/B1) even though capacity data exists server-side. Missed conversion lever, not a defect. |
| **Medium** | Review empty state is two bare text lines; HistoryScreen's empty-state pattern (icon + title + hint) is the app's own standard. |
| **Low** | 14 shadow declarations (map expand button, tiles…) — most sit on bordered/flat elements. |

### 2. SearchScreen — the first impression
**Level:** anatomy A (search card is genuinely Airbnb-grade), execution C+.
**One lever:** ink + shadow convergence — this screen alone contains all four blacks and 20
shadows; it's the calibration showroom, seen on every open.

| Rank | Issue |
|---|---|
| **High** | Three hardcoded blacks as text/fills (`#111827`, `#0f172a`, `#0B1220`) plus 15 × `#0a8050` — the sweep that fixed 9 other screens never reached the app's most-seen screen. |
| **High** | 20 shadow/elevation declarations (search card, finding pill, filter sheet, slider thumbs, pins…). E3 budget: search card + selected-pin card. |
| **Medium** | Filter-sheet selected state is `#0f172a` navy fill — a fifth "brand" colour that exists nowhere else; should be ink token or brand-dark. |
| **Medium** | Radii 8/10/12/14/20/22/99/999 across the screen; the search card's 22 and filter sheet's 24 are both fine individually but should be one value. |
| **Low** | `fontSize: 9.5` filter-count badge — below the app's legibility floor; 11 minimum. |

### 3. MapBottomCard — the discovery card
**Level:** the closest thing to the calibration target in the codebase — priceCard token,
hairline separation, quiet suffix, icon-only chips, springPop heart. Keep as reference.

| Rank | Issue |
|---|---|
| **Medium** | "SOLD OUT" — uppercase + letter-spaced reads as shouting; TGTG's equivalent is a quiet "Sold out" pill on the image. Sentence-case it. |
| **Low** | Title/rating inks are `#111827`, not `colors.text`; chip fill `#F2F5F7` and image fallback `#edf1f4` bypass `surface.muted`. |

### 4. BookingSummaryScreen — checkout
**Level:** trust anatomy A (shield, method pills, "Powered by Stripe", reassurance, recovery
card with next action). Execution B–.
**One lever:** map the 13 font sizes onto the scale — checkout is where visual wobble reads
as risk.

| Rank | Issue |
|---|---|
| **High** | 13 font sizes (10→28), zero `textStyles`. The legal line at ~11 is correct (E6); the other tiny sizes aren't legal text. |
| **Medium** | Hand-drawn Mastercard circles and a text "VISA" pill — homemade payment marks undercut the exact trust they exist to create. Use real brand assets (Stripe provides them). |
| **Medium** | Radii 2/6/8/12/14/18/20/999 on one screen. |
| **Low** | Local `CARD_SHADOW` duplicates `theme.cardShadow` verbatim — drift waiting to happen. |

### 5. HistoryScreen — post-purchase home
**Level:** pattern-setter for tabs/empty states/refresh; token discipline mid-pack.

| Rank | Issue |
|---|---|
| **High** | 10 radius values (6, 12, 14, 16, 18, 20, 22, 30, 36, 999) — the widest spread per component count in the app. |
| **Medium** | `fontSize: 10` status text — below floor. |
| **Low** | Residual literals (`#F0FDF8`, `#E3E8EE`, `#D4DCE4`) with token equivalents. |

### 6. BookingDetailScreen — the "how do I get in" moment
**Level:** flat and calm (0 shadows — correct); palette is the problem.

| Rank | Issue |
|---|---|
| **High** | Raw Tailwind greys (`#F8FAFC`, `#E5E7EB`, `#374151`) and 5 × `#DC2626` danger instead of theme neutrals/`colors.danger` — cool-grey cast visibly differs from the app's warm-neutral tokens on adjacent screens. |
| **Medium** | fontSize 30 + 28 + 20 + 18 + 16 + 15 + 14 + 13… — 11 sizes; access-code/hero hierarchy would survive 4. |

### 7. ListingsScreen — host dashboard *(fingerprint + bible §0 audit)*
Higher density budget is legitimate (A2); token chaos isn't.

| Rank | Issue |
|---|---|
| **High** | 13 radius values incl. 100; two unrelated green systems on one screen (`#065f46` Tailwind emerald text vs brand `#0a8050`); 6 × `#92400e` amber text. |
| **Medium** | Border + shadow stacking on flat cards (named in bible A5 as this screen's pattern). |
| **Low** | `fontSize: 38` stat numerals — fine as a deliberate stat scale; tokenise as such. |

### 8. FavoritesScreen *(fingerprint only)*
| Rank | Issue |
|---|---|
| **High** | 11 × hardcoded `#0a8050` + slate greys (`#64748b`) from outside the palette — un-swept screen in a swept app. |
| **Low** | Radii 12/14/18/36/999 — minor spread. |

### 9. HostBookingDetailScreen *(fingerprint only)*
| Rank | Issue |
|---|---|
| **Medium** | Hardcoded status colours (5 × `#b42318`, ad hoc blue tint `#f0f6ff`) parallel to the theme's status system — two status languages host-side vs driver-side. |
| **Medium** | fontSize 34/28/26 top-end with 13 total sizes; radii 5→22. |

### 10. PaymentsScreen *(fingerprint only)*
| Rank | Issue |
|---|---|
| **High** | Zero theme import — every colour/size hardcoded, including its own greens (`#C6EAD8`, `#F1FAF5`) and greys. Will drift on every edit. |

### 11. WelcomeScreen — first screen a new user ever sees
| Rank | Issue |
|---|---|
| **Medium** | No theme import; brand values eyeballed in (`#0a8050`, `#6B7280`, `#D9DEDE`). Structure itself is clean and calm. |
| **Low** | Button radius 16 vs theme's 14; hardcoded 20px screen margin vs `spacing.screenX` 24. |

### 12. ReviewScreen *(fingerprint only)*
| Rank | Issue |
|---|---|
| **Medium** | No theme import; inactive stars `#d1d5db` instead of `colors.star.inactive`; the moment a user judges quality shouldn't itself look off-palette. |

### 13. VehicleTypeScreen
Rebuild already planned (profile-redesign follow-up). Note: the blue/orange/tan hexes are
car-colour swatches — legitimate content colours, not violations. Radii 10/11/12/18/23/999
and the rest should fall out of the rebuild. **Medium** overall; don't patch, rebuild.

### 14. ProfileScreen · OnboardingPermissionsScreen · SignInScreen · RegisterScreen
The redesigned profile section is the discipline model: ≤4 radii, coherent sizes, near-zero
literals, profileUi kit. **Low** residuals only (fractional sizes 11.5–15.5 on Profile;
a stray `#f1f5f9` on Onboarding). No action needed beyond the eventual fractional-size
convergence.

---

## What to fix first (conversion-weighted)

1. **Host block on ListingScreen** (Critical, S-none — new anatomy, E10.1). Needs API field
   check (host name/joined-year likely already on the listing payload).
2. **One ink** (S1): mechanical sweep — `#111827`/`#0f172a`/`#0B1220` text/fill → tokens.
   SearchScreen, MapBottomCard, ListingScreen residuals, Welcome.
3. **Funnel type scale** (S2): Listing → BookingSummary → Search onto
   `textStyles` + a ~5-size local scale. Biggest per-hour premium gain after ink.
4. **Radius convergence to the E2 bands** (S3): History, Listings, Listing, Search.
5. **Shadow budget** (S4): SearchScreen 20 → 2; ListingScreen 14 → ~3.
6. **Un-swept screens onto theme** (S5): Favorites, Payments, Review, Welcome, BookingDetail
   greys.
7. **Scarcity pill + review-tag highlights** (E7, E10.2): new honest-urgency and trust
   features once the hygiene above is done.

Items 2–6 are pure refactors — no layout changes, screenshot-diffable, safe to do
incrementally per screen. Item 1 and 7 are small feature work.
