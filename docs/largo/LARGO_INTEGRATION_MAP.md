# Largo Integration Map

> **Sprint 3.6 — B1 — `b1/largo-integration-map`** ·
> Documentation-only mapping sprint. Read-only audit of the existing
> Flyeas runtime to identify the smallest safe step that connects the
> already-merged Largo customer-safe module to the live app **without
> replacing any existing flow**.
>
> **Author scope:** mapping only. No code changes outside this file.
> No tests run. No Largo deny-listed paths touched.

---

## 1. Purpose

Flyeas is a deployed Next.js 14 (App Router) product with a public
landing page, a logged-in app shell, a mission/watcher loop backed by
Supabase, and a payment hold layer (Stripe + on-chain USDC escrow). The
Largo customer-safe advice module has been built and merged as an
**isolated** vertical slice (components, demo pages, stub pipeline)
under `components/largo/**`, `lib/largo/**`, `types/largo/**`, and
`app/(demo)/largo-*/**`.

This document maps the existing Flyeas runtime, identifies three viable
integration points for Largo, ranks them by risk and UX impact, and
recommends the smallest safe step for the next implementation sprint.
The deliverable of *that* next sprint will surface Largo to a user for
the first time outside the `/largo-*` demo pages.

The map is intentionally exhaustive on file paths so the next sprint
can be planned without re-running discovery.

---

## 2. Current Flyeas App Structure

High-level view (relevant subtrees only):

```
app/
  layout.tsx                       # root <html> + providers (Server)
  page.tsx                         # PUBLIC landing — Client
  (app)/
    layout.tsx                     # logged-in wrapper → AppShell (Server)
    dashboard/page.tsx
    trip-builder/page.tsx
    flights/page.tsx
    hotels/page.tsx
    cars/page.tsx
    group-trip/page.tsx
    missions/
      page.tsx                     # missions list — Client
      new/page.tsx                 # 3-step wizard — Client
      [id]/cockpit/page.tsx        # live mission cockpit — Client
    favorites/page.tsx
    bookings/page.tsx
    rewards/page.tsx
    referral/page.tsx
    account/page.tsx
    settings/page.tsx
  (demo)/
    largo-preview/page.tsx         # B1 Sprint 3.3 — already merged
    largo-search/                  # B1 Sprint 3.5 — already merged
      page.tsx
      largo-search-demo-client.tsx
  api/
    missions/
      list/route.ts
      create/route.ts
      [id]/...                     # cockpit polling endpoints
    flights/search/route.ts
    hotels/search/route.ts
    webhooks/stripe/route.ts       # (inferred from create flow)

components/
  layout/
    app-shell.tsx                  # Client — orchestrates shell
    sidebar.tsx                    # Client — nav links
    topbar.tsx
    bottom-nav.tsx
  trip-planner-hero.tsx            # landing hero CTA
  live-deals.tsx                   # landing deals strip
  ui/...                           # design-system primitives
  largo/
    advice-card.tsx                # B1 Sprint 3.1
    advice-list.tsx                # B1 Sprint 3.2
    search-form.tsx                # B1 Sprint 3.4

lib/
  store/missions-db.ts             # Supabase | JSON backend selector
  payments/stripe.ts               # Stripe hold + capture
  payments/escrow.ts               # USDC escrow on-chain helpers
  types.ts                         # Mission, MissionProposal, etc.
  largo/
    producer/stub.ts               # Sprint 1.2 — pure stub
    validator/advice-validator.ts  # Sprint 1.3
    validator/customer-safe-validator.ts  # Sprint 2.3
    safe-view/strip.ts             # Sprint 1.1

types/largo/
  advice.ts                        # internal Largo types
  customer-safe-advice.ts          # customer-safe subtype

supabase/migrations/
  20260424000001_missions_tables.sql   # missions + mission_proposals
```

Stack: Next.js 14.2.28 App Router, React 18.3.1, Tailwind 3.4.17,
Supabase JS client, Stripe SDK, viem/wagmi (escrow). TypeScript with
strict mode. Tests run via custom `tsx` harness using `node:assert/strict`.

---

## 3. Public Landing Page Findings

| Question | Answer |
|---|---|
| Homepage file | `app/page.tsx` |
| Server / Client | **Client Component** (`'use client'` at line 1) |
| Hero copy "Know the real price. Then decide." | `app/page.tsx` lines 100–101 — split across `<br/>` + `<em>`: `Know the real price.<br />` then `<em>Then</em> decide.` |
| "Try it now — live data, no login" prompt | `app/page.tsx` line 124 — `<p className="text-micro uppercase text-pen-3 mb-3">Try it now — live data, no login</p>` |
| External imports | `useEffect`, `useState` from `react`; `Link` from `next/link`; `TripPlannerHero` from `@/components/trip-planner-hero`; `LiveDeals` from `@/components/live-deals`; `Accordion`, `AccordionItem` from `@/components/ui/accordion`; `ArrowRight`, `Check`, `Minus`, `ShieldCheck`, `Lock`, `Globe`, `CreditCard` from `lucide-react` |
| Inline subcomponents | `TopNav` (256–277), `LogoMark` (279–287), `MissionVisual` (289–314), `PricingCard` (316–343), `Footer` (345–391), `FooterCol` (382–391) |

The "Try it now" prompt area at line 124 is the natural hook for a
landing-side Largo preview. The hero copy itself (`Know the real
price. Then decide.`) is a thematic match for Largo's BUY/WAIT/MONITOR
semantics and would benefit from a live demonstration directly under it.

---

## 4. Dashboard / App Shell Findings

| Layer | File | Type |
|---|---|---|
| Root layout | `app/layout.tsx` | Server |
| Logged-in wrapper | `app/(app)/layout.tsx` | Server (delegates to AppShell) |
| AppShell | `components/layout/app-shell.tsx` | **Client** |
| Sidebar | `components/layout/sidebar.tsx` | **Client** |
| Topbar | `components/layout/topbar.tsx` | (not opened) |
| BottomNav | `components/layout/bottom-nav.tsx` | (not opened) |

The `app/(app)/layout.tsx` wraps every authenticated route. The shell
imports user/identity/profile/streak Zustand stores and uses
`usePathname()` from `next/navigation` for active-link highlighting.
Sidebar labels are i18n'd via `useLocale()` and an internal
`labelKey` mapping (e.g. `sidebar.dashboard`, `sidebar.tripBuilder`,
`sidebar.missions`).

| Sidebar Section | Label | href | Page file |
|---|---|---|---|
| Travel | Dashboard | `/dashboard` | `app/(app)/dashboard/page.tsx` |
| Travel | Trip Builder | `/trip-builder` | `app/(app)/trip-builder/page.tsx` |
| Travel | Flights | `/flights` | `app/(app)/flights/page.tsx` |
| Travel | Hotels | `/hotels` | `app/(app)/hotels/page.tsx` |
| Travel | Cars | `/cars` | `app/(app)/cars/page.tsx` |
| Travel | Group Trip | `/group-trip` | `app/(app)/group-trip/page.tsx` |
| Watches | Missions | `/missions` | `app/(app)/missions/page.tsx` |
| Watches | Favorites | `/favorites` | `app/(app)/favorites/page.tsx` |
| Watches | Bookings | `/bookings` | `app/(app)/bookings/page.tsx` |
| You | Rewards | `/rewards` | `app/(app)/rewards/page.tsx` |
| You | Referral | `/referral` | `app/(app)/referral/page.tsx` |
| You | Account | `/account` | `app/(app)/account/page.tsx` |
| You | Settings | `/settings` | `app/(app)/settings/page.tsx` |

Note: the prompt's user-visible label "Watches" maps to the **Missions**
section in code. The product treats the two terms as synonyms; the
sidebar groups Missions + Favorites + Bookings under a "Watches"
heading, but the route segment is `/missions`.

---

## 5. Missions and Watches Findings

| Concern | Finding |
|---|---|
| Missions list page | `app/(app)/missions/page.tsx` — Client; fetches `GET /api/missions/list` on mount with `cache: 'no-store'` |
| Mission card rendering | **Inline** in `app/(app)/missions/page.tsx` lines 104–165. **No separate `MissionCard` component exists.** |
| Card displayed fields | route (`originCity || origin → destinationCity || destination`), status badge (8 states), payment-rail icon, dates (`departDate → returnDate`), `passengers · cabinClass`, `Budget = formatUsd(maxBudgetUsd)`, `Best seen = formatUsd(bestSeenPrice)`, `Checked = timeAgo(lastCheckedAt)` |
| "+ New Mission" button | `app/(app)/missions/page.tsx` lines 75–84 (header) and 186–195 (empty state). Both are `<Link href="/missions/new">` |
| New Mission page | `app/(app)/missions/new/page.tsx` — Client, 3-step wizard: **Trip Details → Preferences → Budget & Auto-Buy** (`STEPS = ['Trip Details', 'Preferences', 'Budget & Auto-Buy']`) |
| Mission detail | `app/(app)/missions/[id]/cockpit/page.tsx` — Client, polls `GET /api/missions/[id]` every 5s |
| Data source | **Supabase (prod)** when `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; **JSON file** `.data/missions.json` as dev-only fallback. Backend selected once at module load in `lib/store/missions-db.ts`. |
| Schema | `supabase/migrations/20260424000001_missions_tables.sql` — tables `missions(id, user_id, status, monitoring_enabled, data jsonb, created_at, updated_at)` and `mission_proposals(id, mission_id FK, status, data jsonb, created_at)`. The `data` JSONB carries the full Mission object; column-level fields are denormalized indexes for the watcher. |
| List API | `GET /api/missions/list` → `app/api/missions/list/route.ts` — calls `listMissions()` and sorts by `createdAt` desc |
| Create API | `POST /api/missions/create` → `app/api/missions/create/route.ts` — validates input, generates UUID, creates Stripe `PaymentIntent` (manual capture) **OR** prepares wallet escrow `depositCallData`, persists Mission with status `awaiting_payment`, returns `{ success, mission, rail, stripe? | wallet? }` |
| Status enum (`MissionStatus` in `lib/types.ts`) | `draft \| awaiting_payment \| monitoring \| proposal_pending \| booked \| completed \| cancelled \| expired` |
| Payment rails | `'stripe'` (Stripe Elements client secret) or `'wallet'` (USDC escrow on Base — see `lib/payments/escrow.ts`) |

The mission card inline JSX is the **only** rendering of a single
mission summary; replicating its structure is not currently
componentized. This matters for option C below.

---

## 6. Existing Runtime Logic Relevant to Largo

Runtime modules (no ML training scripts inspected per scope):

| Path | Role |
|---|---|
| `app/api/missions/list/route.ts` | List missions (Supabase or JSON) |
| `app/api/missions/create/route.ts` | Create mission + initiate hold |
| `app/api/missions/[id]/...` | Cockpit polling, deposit confirmation (inferred) |
| `app/api/webhooks/stripe/route.ts` | Capture / void Stripe holds (referenced from create flow) |
| `app/api/flights/search/route.ts` | Flight offer search & scoring |
| `app/api/hotels/search/route.ts` | Hotel offer search |
| `lib/store/missions-db.ts` | Backend abstraction (Supabase \| JSON) — single point of persistence |
| `lib/payments/stripe.ts` | `createMissionHold`, `isStripeConfigured`, `isLiveMode` |
| `lib/payments/escrow.ts` | `buildDepositCallData`, `isEscrowConfigured`, address helpers, `toUsdcBaseUnits` |
| `lib/types.ts` | `Mission`, `MissionProposal`, `MissionStatus`, `MissionProposalStatus`, `PaymentRail` |

**How mission lifecycle works (read-only inference):**

1. User opens `/missions/new` → 3-step form built locally with a
   `FormState` object (`type`, `origin`, `destination`, dates,
   `maxBudget`, `paymentRail`, `autoBuyThreshold`…).
2. Submit → `POST /api/missions/create` returns either a Stripe
   `clientSecret` (used by Stripe Elements on the same page) or
   wallet `depositCallData` (used via wagmi `writeContract`).
3. Once the hold is confirmed (Stripe webhook → status updates the row
   to `monitoring`; wallet → user-signed tx + `confirm-deposit`
   endpoint), a server-side watcher loop (cron + `flights/search`
   composition) periodically re-prices the route, updates
   `bestSeenPrice` + `lastCheckedAt`, and emits `MissionProposal`
   rows when an offer is below the auto-buy threshold.
4. Cockpit polls every 5s and renders the live state.

**Where Largo *does not* belong yet:** anywhere in the create→capture
loop. The Sprint 3.x merged module is stub-only and has zero upstream
data; using it to gate a payment, decide an auto-buy, or override the
existing scoring would violate B1's customer-safe charter and risk
real money. Largo is **advisory** in Phase 1 — that's a hard line.

---

## 7. Largo Module Already Available

The merged customer-safe module exposes the following surface (all
under deny-list for this sprint and only consumed read-only here):

| Artefact | Path | Kind |
|---|---|---|
| Card | `components/largo/advice-card.tsx` | Server-renderable |
| List | `components/largo/advice-list.tsx` | Server-renderable |
| Search form | `components/largo/search-form.tsx` | Client (event handlers) |
| Producer (stub) | `lib/largo/producer/stub.ts` | Pure, deterministic |
| Validator (full) | `lib/largo/validator/advice-validator.ts` | Pure |
| Strip | `lib/largo/safe-view/strip.ts` | Pure |
| Validator (customer-safe) | `lib/largo/validator/customer-safe-validator.ts` | Pure |
| Type — internal | `types/largo/advice.ts` | TS only |
| Type — customer-safe | `types/largo/customer-safe-advice.ts` | TS only |
| Demo — preview | `app/(demo)/largo-preview/page.tsx` | Server |
| Demo — interactive | `app/(demo)/largo-search/page.tsx` + `largo-search-demo-client.tsx` | Server + Client |

End-to-end pipeline (already proven on `/largo-search`):

```
StubLargoAdviceInput
  → produceStubLargoAdvice          (pure)
  → validateLargoAdvice              (pure, may reject)
  → stripToCustomerSafe              (pure)
  → validateCustomerSafeAdvice       (pure, may reject)
  → CustomerSafeAdvice
  → <LargoAdviceCard /> | <LargoAdviceList />
```

Phase-1 invariants enforced by the module:

- `can_autobuy` is **always** false at the contract level.
- Booking notice rendered as the literal: **"Automatic booking is not yet available"**.
- No numeric confidence value reaches the customer surface.
- `observed_price_usd === null` → "Price unavailable" (never `$0`).
- `primary_provider === null` → "Provider unavailable" (never invented).
- 25 forbidden customer-side keys are scanned both at validator level
  and via test-time source scans.

---

## 8. Integration Options

Three viable hook-points, each scored against the convergence-mode
discipline (smallest safe step first; advisory only; stub-pipeline by
default).

### Option A — Landing prompt integration

Surface Largo on `app/page.tsx` directly under the "Try it now — live
data, no login" prompt (line 124). The visitor sees a working
search-and-advise demo on the public homepage, before any auth or
mission creation.

| Aspect | Detail |
|---|---|
| Files involved | **Edit** `app/page.tsx` only — replace or augment the prompt block at line 124 with a single import + render. **Optional new file** `components/landing/largo-prompt-section.tsx` to keep `app/page.tsx` short (mirrors `app/(demo)/largo-search/largo-search-demo-client.tsx` 1:1). |
| Largo components used | `LargoSearchForm` + `LargoAdviceList` (or single `LargoAdviceCard`) |
| Data passed | `StubLargoAdviceInput` built by the form, run through the merged pipeline. No real provider data. |
| Stub pipeline first? | **Yes** — re-uses the proven `produceStubLargoAdvice → … → CustomerSafeAdvice` chain verbatim. |
| Backend / API work? | **No.** Pure client-side state machine, identical to `/largo-search`. |
| Risk | **LOW.** Public page, no payment surface, no auth, no mission state. The Phase-1 booking notice is enforced by the card itself. |
| UX impact | **HIGH.** Makes the `Know the real price. Then decide.` thesis tangible above the fold; converts a static prompt into a live preview. |
| Caveats | (i) The `Try it now — live data, no login` text currently implies real data — must be reworded to "Preview only" or kept above the Largo block with a clear "Preview" label so users don't expect live offers. (ii) Don't replace `TripPlannerHero` — it's the existing primary CTA. |

### Option B — New Mission / Trip Builder integration

Inject a Largo advisory card inside the New Mission wizard
(`app/(app)/missions/new/page.tsx`), most likely between Step 1 (Trip
Details) and Step 2 (Preferences), or as a passive panel in Step 3
(Budget & Auto-Buy) showing "Largo currently suggests: WAIT" before
the user commits the budget hold.

| Aspect | Detail |
|---|---|
| Files involved | **Edit** `app/(app)/missions/new/page.tsx` (a multi-step component, ~600+ lines based on FormState surface). New optional wrapper `components/largo/mission-advisory.tsx` to convert `FormState` → `StubLargoAdviceInput` and render a `LargoAdviceCard`. |
| Largo components used | `LargoAdviceCard` (single card; list semantics not needed) |
| Data passed | Mapped from the wizard's `FormState`: `origin → origin`, `destination → destination`, `departDate`, `returnDate`, `passengers`, `cabin_class`, `surface: 'mission_scan'`, `observed_price_usd: null`, `primary_provider: null`, `route_known_to_model: false`, `now_iso: new Date().toISOString()`. |
| Stub pipeline first? | **Yes.** |
| Backend / API work? | **No** if stub-only. **Yes** later if we want a real route-known signal — would need a new `/api/largo/advice` endpoint, which is out of scope for the first integration sprint. |
| Risk | **LOW–MEDIUM.** Higher-trust surface (user is about to authorize a payment hold). The advisory must be unambiguously labeled "Preview" and **must not block** the wizard. |
| UX impact | **MEDIUM.** Pre-purchase reassurance; potentially conflicting if the mission ends up booking despite a Largo `WAIT`. Until Largo becomes real, mixed signals are a real risk. |
| Caveats | The wizard is a self-contained client component with `Card`, `Input`, `Select`, `Button` UI primitives — Largo's Tailwind + light-on-dark style must be reconciled. The wizard's `cabinClass` strings differ from Largo's `cabin_class` enum — a mapping helper is needed. |

### Option C — Watches / Mission card integration

Embed a compact `LargoAdviceCard` inside each mission card on
`app/(app)/missions/page.tsx` (lines 104–165) — or, less invasively,
inside the cockpit page sidebar.

| Aspect | Detail |
|---|---|
| Files involved | **Edit** `app/(app)/missions/page.tsx` (the inline card) **OR** `app/(app)/missions/[id]/cockpit/page.tsx` (the per-mission detail). Adding a sidecar component `components/largo/mission-card-advisory.tsx` would be needed since the mission card is currently inline JSX. |
| Largo components used | `LargoAdviceCard` (compact: `compact={true}` and/or `compactCards={true}` on list) |
| Data passed | Derived from each `Mission` row at render time. The Mission object already has `origin`, `destination`, `departDate`, `returnDate`, `passengers`, `cabinClass`, `bestSeenPrice` (real, not null), `paymentRail`. |
| Stub pipeline first? | **Yes** initially — but it would mean rendering identical "WAIT/ABSTAIN" advice for every mission, which is misleading on a live surface. |
| Backend / API work? | **Eventually yes.** To be useful, advice must vary per mission, which requires a real Largo evaluator — i.e. wiring V7a or another model behind a `/api/largo/advice` endpoint. Until that exists, this option's value is near zero. |
| Risk | **MEDIUM–HIGH.** This is a high-trust surface where users see real `bestSeenPrice` and real status. Stub advice next to real prices invites mistrust. |
| UX impact | **HIGH but RISKY.** Could become flagship UX once the real evaluator exists; premature with stub-only data. |
| Caveats | The mission card needs to be extracted into a `MissionCard` component first (currently inline, lines 104–165 of `missions/page.tsx`). That refactor alone is a meaningful change to a high-traffic file. |

**Ranking (smallest safe step first):**

| Rank | Option | Touches | Backend? | Risk |
|---|---|---|---|---|
| 1 | **A (Landing prompt)** | `app/page.tsx` (+ optional landing wrapper) | No | LOW |
| 2 | B (New Mission advisory) | `app/(app)/missions/new/page.tsx` | No (initially) | LOW–MED |
| 3 | C (Mission card / cockpit) | mission card or cockpit + new advisory wrapper | Yes (eventually required) | MED–HIGH |

---

## 9. Recommended Next Sprint

**Sprint 3.7 — Landing-page Largo preview (Option A).**

Rationale:
- Smallest blast radius — public, unauthenticated, no payment surface.
- Re-uses the already-merged `largo-search-demo-client.tsx` state
  machine 1:1 — no new integration code to invent.
- Stub pipeline only — no backend changes, no new API route, no
  database migration, no auth dependency, no Supabase contact.
- The hero copy `Know the real price. Then decide.` is a thematic
  match: the Largo card answers exactly that question.
- Easy to revert via a single-file rollback on `app/page.tsx`.
- Production-visible — first time Largo surfaces outside `/largo-*`
  demo routes.

Sprint 3.7 spec:

| Field | Value |
|---|---|
| Branch name | `b1/landing-largo-prompt` |
| Files allowed to edit | `app/page.tsx` (1 edit: replace the "Try it now — live data, no login" prompt block with a section that imports a new wrapper component) |
| Files allowed to create | `components/landing/largo-prompt-section.tsx` (new wrapper, mirrors `app/(demo)/largo-search/largo-search-demo-client.tsx` and adds a "Preview" label) **AND** `tests/landing/largo-prompt-section.test.tsx` |
| Files **forbidden** | `components/largo/**` (no edits to existing Largo primitives), `lib/largo/**`, `types/largo/**`, `app/(demo)/**`, all `app/api/**`, all `app/(app)/missions/**`, `lib/store/**`, `lib/payments/**`, `supabase/**`, `.github/**`, `scripts/**`, `package.json`, `tsconfig.json`, `next.config.js`, `vercel.json`, `.env*` |
| Tests to add | `tests/landing/largo-prompt-section.test.tsx`: (a) renders form + idle state, (b) submitting form transitions to success and renders an `LargoAdviceList`, (c) error path renders generic message, (d) source-scan for the 25 forbidden customer-side keys, (e) source-scan for `'use client'` placement (top of file, before imports), (f) imports allow-list (only `react` + `@/components/largo/*` + `@/lib/largo/*` + `@/types/largo/*`), (g) "Preview only. Automatic booking is not yet available." literal present, (h) no `%` character emitted in rendered HTML. |
| Demo or production-visible? | **Production-visible** (replaces the public landing's prompt block). |
| Touches backend? | **No.** Pure client-side state machine. No fetch, no Supabase, no Stripe, no escrow. |
| Phase-1 invariants required | (i) booking notice literal "Automatic booking is not yet available" rendered, (ii) no numeric confidence reaches HTML, (iii) no `%` in rendered HTML, (iv) no forbidden customer-side keys present in source. |
| Convergence-mode rules | Diff before exec; format respected mot-pour-mot; parallel findings noted but not opened; no git ops by Claude. |

Out of scope for Sprint 3.7 (track for later sprints):

- Replacing `TripPlannerHero` (stays untouched).
- Modifying any Largo component.
- Any change in `app/(app)/**` or `app/(demo)/**`.
- Any backend / API work.

---

## 10. Risks and Non-Goals

**Risks of the recommended sprint (A):**

- The current "Try it now — live data, no login" copy implies real
  data. Embedding stub-only Largo here without re-labeling could
  mislead first-time visitors. Mitigation: the new wrapper renders an
  explicit "Preview" badge and the Phase-1 booking-notice literal.
- A change to `app/page.tsx` is high-traffic; review must verify the
  rest of the page is byte-unchanged outside the prompt block.
- Production visibility means any regression hits all visitors.
  Mitigation: the embedded section is purely additive (new wrapper)
  and the existing `TripPlannerHero` + `LiveDeals` blocks stay
  untouched.

**Risks deferred (apply to options B and C, *not* the recommended sprint):**

- Option B introduces Largo into the payment-hold path's UI. Even as
  pure advisory, it changes user expectation right before money moves.
- Option C without a real evaluator yields identical advice on every
  mission — actively misleading.
- Both B and C require eventually wiring a real Largo evaluator
  endpoint (`/api/largo/advice`); the V7a model is shadow-validated
  but not yet integrated, and that integration is its own multi-sprint
  effort outside the current B1 mapping.

**Non-goals (this sprint):**

- No code changes outside `docs/largo/LARGO_INTEGRATION_MAP.md`.
- No tests run.
- No commit, no push, no PR.
- No invocation of any `vercel-functions`, `next-cache-components`,
  `nextjs`, or other auto-suggested skills (parallel findings noted,
  not opened — convergence-mode discipline).
- No inspection of ML training scripts under `scripts/cloud/v7a/**`,
  `scripts/train/v7a/**`, `models/v7a/**`, `models/v76/**`, or any V7.6
  Ultra asset.
- No reliance on the pre-existing dirty-worktree state under
  `scripts/**`, `.github/workflows/**`, `docs/**`, `logs/**`,
  `reports/**` (out of sprint scope).

---

## 11. Files Inspected

Read-only inspection (no write, no execution):

| Path | Purpose |
|---|---|
| `.git/HEAD` | branch verification |
| `app/page.tsx` (via Explore agent) | landing page, hero copy, Try-it-now prompt |
| `app/(app)/layout.tsx` (via Explore agent) | logged-in wrapper |
| `components/layout/app-shell.tsx` (via Explore agent) | shell composition |
| `components/layout/sidebar.tsx` (via Explore agent) | sidebar nav |
| `app/(app)/missions/page.tsx` | missions list, inline card |
| `app/(app)/missions/new/page.tsx` (partial) | New Mission wizard |
| `app/(app)/missions/[id]/cockpit/page.tsx` (partial) | mission cockpit |
| `app/api/missions/list/route.ts` | list endpoint |
| `app/api/missions/create/route.ts` | create + payment hold |
| `lib/store/missions-db.ts` | persistence backend |
| `components/largo/advice-card.tsx` (header) | Largo card surface |
| `components/largo/advice-list.tsx` (header) | Largo list surface |
| `components/largo/search-form.tsx` (header) | Largo search form |
| `lib/largo/producer/stub.ts` (header) | stub producer contract |
| `app/(demo)/largo-search/largo-search-demo-client.tsx` | reference state-machine pattern |

No file under the deny-list was written, edited, formatted, staged, or
otherwise mutated.

---

## 12. Files Created or Modified

| Path | Action |
|---|---|
| `docs/largo/LARGO_INTEGRATION_MAP.md` | **created** (this file) |

No other path in the working tree was modified by this sprint.
Pre-existing dirty files under `scripts/cloud/**`, `scripts/train/**`,
`scripts/ingest/**`, `.github/workflows/**`, `docs/**`, `logs/**`,
`reports/**` are unrelated to this sprint and were neither touched nor
relied upon.

---

*End of Largo Integration Map — Sprint 3.6.*
