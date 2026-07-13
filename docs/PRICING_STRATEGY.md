# FreeSpace Pricing Strategy

_Prepared 2026-07-10. Market data verified via competitor help centres and terms as of this date.
Owner: founder. Status: proposal — nothing here is implemented except where noted "(current)"._

---

## 0. Where FreeSpace stands today (challenge the baseline)

Current model: **driver pays host price × 1.08; platform keeps the 8% markup (= 7.4% of gross);
host keeps 100% of their set price; fee is baked into the displayed price.**

Verdict: the *structure* is right (all-in display, driver-funded, host keeps 100%) — it is the
same structure the market leaders converged on. The *level* is wrong in two ways:

1. **7.4% of gross is the lowest take rate in the industry** — half of JustPark's effective
   take, a third of YourParkingSpace's, a quarter of Parkhound's. We are leaving margin on the
   table that drivers demonstrably pay elsewhere.
2. **No minimum fee means small bookings lose money.** Stripe EU cards cost 1.5% + €0.25.
   A €2.00 hourly booking earns FreeSpace €0.16 and costs ~€0.28 to process. Every short
   booking is negative-margin today.

---

## 1. What competitors actually charge (verified)

| Platform | Host side | Driver side | Effective take (of gross) | Display |
|---|---|---|---|---|
| **JustPark** (UK/IE) | 3% of earnings | Transaction fee: 12% of booking, **min £0.69, capped £1.99** (£2.49 multi-booking) | ~8–15% on small bookings, →~4% on large (cap) | Fee added at checkout |
| **YourParkingSpace** (UK) | 3% processing fee | **+20% uplift** baked into displayed price | ~19.6% | All-in |
| **Parkhound / Spacer** (AU) | 3% admin fee | **+30% markup** baked in | ~25.6% | All-in |
| **Neighbor** (US, storage/parking) | 4.9% + $0.30 processing | 8–20% service fee (usually 10–15%) | ~15–25% | Fee shown before booking |
| **SpotHero / ParkWhiz** (US, commercial) | Margin negotiated with operators | No consumer convenience fee | est. 15–25% (not public) | All-in |
| **Airbnb** (benchmark) | Moving everyone to **host-only 15.5%**, guest sees final price | — | 15.5% | All-in (EU law pressure) |
| **Turo** (benchmark) | Host keeps 60–90% depending on protection tier | Trip fee | 10–40%; **fee = insurance risk transfer** | Fee at checkout |

Patterns worth stealing:

- **3% host fee is the industry Schelling point** (JustPark, YPS, Parkhound all landed there,
  branded as "processing/admin", not "commission"). Hosts tolerate it; marketing still says
  "list for free".
- **The real take lives on the driver side, baked into the price.** YPS +20% and Parkhound +30%
  prove peer-parking demand tolerates large markups — because the base price is 50–70% below
  commercial car parks, the marked-up price still looks cheap.
- **JustPark's cap is a conversion weapon on big bookings** — a £500 monthly booking carries a
  £1.99 fee (0.4%). They win long-stay on price; they monetise short-stay.
- **Airbnb's 2025–26 move is the strongest signal in the dataset:** the biggest marketplace in
  the world concluded that *guests seeing the final price with no checkout add-ons* converts
  better, and shifted the whole fee to the supply side to get it. EU price-display law
  (and the Irish CPC's drip-pricing enforcement) points the same direction.
- **Turo shows fees can price risk, not just service** — their "commission" is really an
  insurance premium. Parking has far lower damage risk; this is a later lever, not a launch one.

---

## 2. The five questions

**1. What converts best?** All-in displayed pricing with zero checkout add-ons. Drip pricing
(fees appearing at checkout) is the single best-documented conversion killer in e-commerce, and
it's why SpotHero advertises "no convenience fee" and Airbnb is eating the fee visibility
itself. FreeSpace already does this. Keep it permanently.

**2. What maximises host acquisition?** "Keep 100% of your price" (or at worst 97%). Hosts are
the scarce side in a new market and they comparison-shop the headline. Driver-side funding is
invisible to hosts — they set €5, they get €5. JustPark's UK dominance was built on free
listing + tiny host fee.

**3. What maximises revenue?** A high driver-side markup (YPS/Parkhound style, 20–30%) with
dynamic/event uplift. But it taxes conversion on price-sensitive commuters and hands a
price-comparison win to any competitor. Revenue-max ≠ market-max at our stage.

**4. What has least friction?** Exactly what FreeSpace has: one number, fee inside, no host
invoicing, no subscriptions. The only friction today is *ours*: no minimum fee means we
subsidise the least valuable bookings.

**5. What should an Irish startup do to dominate?** Underprice the incumbent *where it's
visible* (host side, long-stay), monetise *where it isn't* (baked-in short-stay markup), and
protect unit economics with a fee floor. JustPark is present in Ireland but not entrenched —
its weakness is the checkout-fee surprise and a thin Irish supply base. Win supply first.

---

## 3. Recommended pricing system

### Driver pricing

| Element | Recommendation |
|---|---|
| Structure | **Percentage markup baked into displayed price** (keep current architecture) |
| Rate — hourly/daily | **Raise 8% → 12%** at next pricing review; hold 12% through launch year |
| Rate — monthly | **10%** (recurring revenue justifies thinner take; keeps monthly price competitive) |
| Minimum fee | **€0.49 per booking** — kills negative-margin micro-bookings (Stripe floor is ~€0.28 + 1.5%) |
| Maximum fee | **€9.99 per booking** — JustPark-style cap so large/monthly bookings stay price-competitive |
| Separate booking fee line | **No. Never.** One all-in price |
| VAT | Display prices VAT-inclusive (consumer law). Platform's fee is a VATable service (23% on our margin — model it in unit economics). Most hosts stay under the €42.5k services threshold and don't charge VAT; add DAC7 income reporting to Revenue on the compliance roadmap |

### Host pricing

| Element | Recommendation |
|---|---|
| Listing | Free, forever |
| Commission at launch | **0% — "you keep 100%"** as explicit acquisition marketing |
| Later (post-liquidity) | Optional **3% "payment processing" fee** — the industry norm — but only after ~1,000 active listings, and **grandfather founding hosts at 0% for life** (cheap loyalty, powerful referral story) |
| Subscription | No |
| Verification fee | No — verification is *our* trust asset, charging for it is anti-growth |
| Payouts | Standard payout free, weekly, after booking start (also closes the "no payout cron" launch gap). Instant cash-out for 1% (min €0.50) as a later convenience upsell |

### Dynamic pricing

- **Hosts set prices; FreeSpace recommends.** **BUILT (2026-07-10), Phase 1:** location-aware
  suggested rates from a curated zone table (Dublin core/inner/county rings + Cork/Galway/
  Limerick + national fallback, feature bumps for EV/sheltered/gated), anchored to public Irish
  market data (Parkpnp district guides, commercial car-park rates −~40%). Table lives in
  `apps/api/src/lib/priceSuggestions.ts`, served via `GET /api/config` (tunable without an app
  release), applied by `apps/mobile/utils/priceSuggestions.ts` which bakes in the same table as
  offline fallback — keep the two identical. Advisory only: prefills the mobile pricing step,
  never enters booking math. Phase 2: replace zone rates with real comparables ("spaces near
  you earn €X") per-area once ~5+ active listings exist there.
- **Event pricing: yes, opt-in, host-approved.** Dublin is an event-parking goldmine (Aviva,
  Croke Park, 3Arena, RDS). Suggest a multiplier on event days — **1.5–2× for matches, 2–3×
  for concerts/festivals** — host taps approve. SpotHero's operator data (+40% revenue from
  dynamic rates) is the proof point.
- **Rush hour: no.** Driveway inventory isn't elastic intraday; complexity exceeds payoff.
- **AI/auto "smart pricing": later, opt-in only** — after we have booking-density data worth
  modelling. Never silently reprice a host.

### Long-term parking

- Daily/weekly: derived from host rates (current model), weekly = 7× daily with host-set
  discount optional.
- **Monthly: 10% take, recurring via Stripe subscriptions** (matches the existing monthly
  roadmap: enquiry → recurring). Recurring is the LTV engine — a €150/mo commuter space at 10%
  is €180/yr from one relationship.
- **Commuter product** (weekday-only access at a discount) once monthly liquidity exists — it
  lets one space serve a commuter *and* weekend event demand. No competitor in Ireland does
  this well.
- Corporate: manual sales, invoiced, negotiated 15–20%. Not a product until inbound demand
  says so.

### Disintermediation (the monthly killer)

The #1 leak in peer parking: month 1 through the platform, month 2 in cash. Mitigations that
matter more than any fee %: payment protection framing ("covered bookings"), automatic
recurring billing (convenience > 10%), host payout reliability, and cancellation cover. Price
monthly take low (10%) partly *because* the alternative to a low take isn't a high take — it's
zero.

---

## 4. Marketplace growth sequencing

**Subsidise supply first.** In Dublin the constraint is listings, not drivers — drivers have
commercial alternatives; hosts have none. Every pricing decision at launch should favour hosts.

| Stage | Driver take | Host fee | Focus |
|---|---|---|---|
| **Launch** | 8% (current) + €0.49 min fee | 0% | Fix unit-economics floor only. Don't raise % while proving conversion |
| **100 listings** | A/B 8% vs 12% | 0% | Validate take-rate elasticity on real demand |
| **1,000 listings** | 12% short-stay / 10% monthly, €9.99 cap | 0% (announce founding-host guarantee) | Event pricing live for Dublin venues |
| **10,000 listings** | 12–15% short-stay | 3% processing fee for *new* hosts | Instant-payout upsell, commuter product, B2B garage inventory (SpotHero model) |
| **National** | Dynamic within 10–18% band | 3% | Smart pricing, corporate, insurance/guarantee add-on |

**Should FreeSpace charge only drivers during launch? Yes** — and that's the current model.
The change launch actually needs is the minimum fee, not a bigger percentage.

---

## 5. Revenue projection (proposed model, steady state = 12% short / 10% monthly, €0.49 min, €9.99 cap)

Assumptions: blended average transaction €11 (80% short-stay @ €7 avg, 20% monthly @ €140 avg
weighted by booking count ≈ €33 — conservatively haircut to €11–€33 band; table shows both).
Platform take ≈ 11.5% blended; Stripe ≈ 1.5% + €0.25/booking; VAT on our fee excluded from
"net" (≈23% of margin owed on the fee component).

| Monthly bookings | GMV (ATV €11) | Platform revenue | Net of processing | GMV (ATV €33, monthly-heavy) | Platform revenue | Net of processing |
|---|---|---|---|---|---|---|
| 1,000 | €11k | €1.3k/mo | ~€0.8k/mo | €33k | €3.8k/mo | ~€3.1k/mo |
| 10,000 | €110k | €12.7k/mo | ~€8.4k/mo | €330k | €38k/mo | ~€31k/mo |
| 100,000 | €1.1M | €127k/mo | ~€84k/mo | €3.3M | €380k/mo | ~€310k/mo |
| 500,000 | €5.5M | €633k/mo | ~€420k/mo | €16.5M | €1.9M/mo | ~€1.55M/mo |

Honesty check: 500k monthly bookings is JustPark-UK scale compressed into a country 1/13th the
size — treat it as the "plus UK expansion" line, not an Ireland-only outcome. 10k–50k monthly
bookings is a realistic strong Ireland result; that's a €100k–€500k/yr net-revenue business on
parking alone, which is why event pricing, monthly subscriptions, and eventual B2B inventory
matter — they raise ATV and take, not just volume.

---

## 6. Recommendation summary

**Model: driver-funded, all-in, capped-and-floored percentage; hosts keep 100% at launch.**

Why it beats competitors:
- **vs JustPark:** no checkout fee surprise (their weakness), better host deal (0% vs 3%),
  competitive long-stay via cap.
- **vs YPS/Parkhound economics:** we can raise toward their 20%+ take *later* from a position
  of supply strength; they can't cut toward ours without breaking their P&L.
- **vs doing nothing:** the €0.49 floor turns every micro-booking from a loss into margin, and
  12% on short-stay roughly +60%s revenue with a price impact of ~37c on a €9 booking.

Risks:
1. **Take-rate rises are visible to drivers** (price creep vs host-set price). Mitigate: raise
   only at listing-growth milestones, never on existing confirmed bookings (snapshot invariant
   already guarantees this).
2. **Monthly disintermediation** — addressed above; accept some leakage as CAC.
3. **JustPark responds in Ireland** — their fee cap makes them cheap on monthly; our 10%
   monthly + recurring convenience is the counter.
4. **Regulatory:** DAC7 host-income reporting, VAT on platform fee, CPC price-display rules —
   all manageable, none optional.

A/B tests to run (in order):
1. **Minimum fee €0 vs €0.49 vs €0.99** on short bookings — conversion impact vs margin.
2. **Markup 8% vs 12%** on search→booking conversion (city-split or time-split).
3. **Monthly take 10% vs 12%** on enquiry→subscription conversion.
4. **Event multiplier suggestion accept-rate** (1.5× vs 2× default) — host-side test.
5. **Fee transparency copy** ("includes service fee" footnote vs nothing) — trust vs conversion.

**Engineering prerequisite — BUILT (2026-07-10):** the fee schedule is now server-driven
config. `PLATFORM_FEE_BPS` / `PLATFORM_MIN_FEE_CENTS` / `PLATFORM_MAX_FEE_CENTS` env vars
(defaults 800/0/unset — bit-exact with the legacy ×1.08) drive `apps/api/src/lib/pricing.ts`;
the schedule is served via `GET /api/config` and applied by all three clients
(`apps/mobile/utils/pricing.ts` via `remoteConfig.ts` at boot, `apps/web/lib/pricing.ts` on
the checkout page). Enabling the €0.49 floor is now an env flip + restart — **but old app
builds that haven't refetched the config will 400 with "price out of date"**, so flip it only
once installed-app adoption of the config-fetching build is high (server verification always
wins; a stale client can never be wrongly charged). Rate A/B tests additionally need a
per-user config split, which this plumbing does not yet do.

---

_Sources: JustPark help centre (transaction fee, space-owner fee), YourParkingSpace support
(commission, processing fee), Parkhound terms of use (30% markup, 3% admin), Neighbor host
docs & reviews (4.9%+$0.30, 8–20% service fee), Airbnb resource centre & PMS-partner analyses
(15.5% host-only transition, 2025–26), Turo earnings-plan docs (60–90 plans), SpotHero press
(IQ dynamic pricing, +40% operator revenue)._
