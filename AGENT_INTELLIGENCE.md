# Flyeas Agent Intelligence — the statistical brain

This is the moat. Everything in the `lib/agent/` directory exists to
turn Flyeas from "a cron that searches for flights" into an agent
that knows **when** to buy based on real statistics.

If you strip this out, you have a commodity price-watcher. If you keep
it and feed it data, you compound an advantage that competitors can't
easily copy — it's what made Hopper a $5B company.

---

## 📦 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    lib/agent/                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  price-history.ts                                            │
│     └── append-only time series of every scan               │
│         • recordSample(route, sample)                       │
│         • getSamples(route)                                 │
│         • getSamplesForWindow(route, daysTTD ± 14)          │
│         • getCoverageScore(route) → 0-1 confidence          │
│                                                              │
│  baselines.ts                                                │
│     └── pure statistical functions                          │
│         • computeBaseline(samples) → {mean, median, stdev,  │
│             p10-p90, trend slope, R², CV}                   │
│         • zScore(price, baseline)                           │
│         • percentileRank(price, samples)                    │
│                                                              │
│  predictor.ts                                                │
│     └── 4-signal decision engine                            │
│         1. Z-score vs historical mean                      │
│         2. Empirical percentile rank                       │
│         3. Trend slope ($/day, last 7d)                    │
│         4. Time-to-departure pressure                      │
│         → BUY_NOW | MONITOR | WAIT + confidence 0-1        │
│                                                              │
│  watcher.ts                                                  │
│     └── orchestrator — ONE entrypoint for "look at a       │
│         mission, record sample, run predictor, return      │
│         decision"                                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
           │
           ↓ used by
┌──────────────────────────────────────────────────────────────┐
│                    app/api/                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  POST /api/missions/[id]/propose                             │
│     └── agent hotline — watchMission() → predictor → if    │
│         BUY_NOW && confidence ≥ 0.6 → capture funds        │
│                                                              │
│  GET  /api/missions/[id]/prediction                          │
│     └── cheap read-only endpoint for the cockpit UI.       │
│         No upstream API burned. Returns baseline, prediction,│
│         30-day sparkline, coverage score.                  │
│                                                              │
│  POST /api/agent/sweep                                       │
│     └── external scheduler webhook (GitHub Actions).       │
│         Loads all active missions, runs the watcher on     │
│         each, fires propose for qualifying ones.           │
│                                                              │
│  GET  /api/cron/monitor                                      │
│     └── Vercel Cron backup (daily on Hobby, every 6h      │
│         on Pro). Same loop as /agent/sweep.                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔍 What the predictor actually computes

For every price observation `P` on a route with samples `S` and
time-to-departure `T`:

**Signal 1 — Z-score**
```
μ = mean(S)
σ = stdev(S)
z = (P - μ) / σ
```
Score mapping: `z ≤ -0.8 → +1.0 (buy)`, `z ≥ +0.6 → -1.0 (wait)`,
linear interpolation between.

**Signal 2 — Percentile rank**
```
pct = (count of samples where price < P) / |S| × 100
```
Score mapping: `pct ≤ 20 → +1.0`, `pct ≥ 70 → -1.0`, linear between.

**Signal 3 — Trend (linear regression over last 7 days)**
```
slope = (N·ΣXY - ΣX·ΣY) / (N·ΣX² - (ΣX)²)
R² = 1 - SSresid / SStot
```
Score mapping:
- `slope ≥ +5/day` → +0.9 (rising, BUY)
- `0 < slope < +5` → +0.4
- `-5 < slope < 0` → -0.3 (falling, consider waiting)
- `slope ≤ -5/day` → -0.7
- `R² < 0.25` → ignored (trend too noisy)

**Signal 4 — Time-to-departure pressure**
- `T < 7d` → +1.0 (URGENT)
- `7 ≤ T < 14` → +0.7
- `14 ≤ T < 30` → +0.2
- `30 ≤ T < 60` → -0.1
- `T ≥ 60` → -0.3 (patient, prices usually drop)

**Composite**
```
composite = 0.40·zScoreSig + 0.25·percentileSig + 0.20·trendSig + 0.15·ttdSig

if composite ≥ +0.4  → BUY_NOW
if composite ≤ -0.3  → WAIT
else                 → MONITOR
```

**Confidence**
```
sampleConf  = min(1, sampleCount / 30)          // 0.5 weight
trendConf   = 0.6 + R²·0.4                       // 0.2 weight
certainty   = min(1, |composite| × 2)            // 0.3 weight
confidence  = 0.5·sampleConf + 0.2·trendConf + 0.3·certainty
```

---

## 🧊 Cold start

With fewer than 5 samples for a route the predictor returns a
conservative `MONITOR` (or `BUY_NOW` if `T < 14` — we never risk
losing a flight just because we lack data). Confidence is capped at
0.35 in cold start, and the cockpit UI shows a "learning" badge
instead of the full prediction panel.

The system becomes **confident** after ~30 samples and **highly
confident** after ~100. Each route compounds independently.

---

## ⏰ How the agent stays "always watching" on $0

Three layers, all free:

| Layer | Frequency | Tech | Cost |
|---|---|---|---|
| **Primary** | every 15 min | GitHub Actions → `/api/agent/sweep` | $0 (unlimited on public repos) |
| **Backup** | every 6 hours (Pro) or daily (Hobby) | Vercel Cron → `/api/cron/monitor` | $0 |
| **On-demand** | instant | "Check now" button in cockpit → `/api/missions/[id]/propose` | $0 |

The three layers converge on the same `watchMission()` function, so
the prediction state is consistent regardless of who triggered it.

**GitHub Actions setup:**

1. Push `.github/workflows/flyeas-watcher.yml` (already committed)
2. Repo Settings → Secrets → Actions:
   - `FLYEAS_BASE_URL = https://faregenie.vercel.app`
   - `FLYEAS_CRON_SECRET = <same value as CRON_SECRET on Vercel>`
3. First run happens within 15 minutes. Watch it in the Actions tab.

On a **private** repo GitHub gives 2000 free Actions minutes/month,
which covers ~960 × 15-min sweeps (one every 45 min of real time).
On a **public** repo it's unlimited.

---

## 📊 What investors see in the cockpit

The `PredictionPanel` component in
`app/(app)/missions/[id]/cockpit/page.tsx` renders:

1. **Big action label** (`STRONG BUY` / `MONITOR` / `WAIT`) in the
   color of the decision
2. **Confidence meter** (0-100% bar)
3. **Natural-language reason** ("$412 is 22% below the $528 average
   for this route based on 87 samples. 81% chance you won't see
   better in the next week. Strong buy.")
4. **4-stat grid**: z-score, percentile, trend arrow, probability
5. **30-day price memory sparkline** (every day's minimum)
6. **Expandable raw statistics** (mean, median, σ, p10-p90, R²) for
   the technically-minded investor who wants to see the math

This is the surface that makes Flyeas *feel* like a real AI agent
rather than a cron job with a chatbot glued on top.

---

## 🎯 Why this is the moat

1. **Data compounds**. Every mission generates proprietary price
   samples that stay in `.data/price-history.json` (or Postgres once
   you migrate). After 6 months of operations the baseline dataset
   becomes a serious asset — a competitor starting from scratch needs
   6 months of history to match your prediction quality.

2. **Transparent reasoning**. Every prediction explains itself. That's
   trustable by users AND auditable by investors. No black box.

3. **Capital efficiency**. Auto-buy only fires when
   `prediction.confidence ≥ 0.6`, which means the AI captures funds
   only when the signal is strong. Lower false-positive rate = better
   margins than blind "cheap flight alert" services.

4. **Kill-switch safety**. Cold start + TTD pressure logic means the
   system never does something catastrophic with low data — it asks
   the user instead.

5. **Investor narrative**. "Our predictor beats the market by X% on Y
   monitored routes" is a concrete, defensible claim once you have
   ~3 months of data. That's a slide in a seed deck.

---

## 🧪 Testing the predictor locally

The module is pure TypeScript with no external deps — you can test
it in isolation:

```ts
import { computeBaseline, zScore } from './lib/agent/baselines';
import { predict } from './lib/agent/predictor';

// Fake route samples
const samples = Array.from({ length: 50 }, (_, i) => ({
  checkedAt: new Date(Date.now() - i * 86400000).toISOString(),
  departDate: '2026-07-15',
  daysUntilDeparture: 60 - i,
  priceUsd: 500 + Math.sin(i / 4) * 80 + Math.random() * 30,
  offerCount: 10,
}));

const result = predict({
  currentPrice: 420,
  daysUntilDeparture: 60,
  windowSamples: samples,
  allSamples: samples,
});

console.log(result.action, result.confidence, result.reason);
```

Run with `npx tsx test-predictor.ts` (after `npm install`).

---

## 🚀 Next-level improvements

These are post-MVP but would significantly strengthen the moat:

1. **Holt-Winters exponential smoothing** for trend + seasonality
   decomposition (currently just linear regression over 7 days)
2. **Route similarity embedding** so a cold-start route can borrow
   baseline from similar routes (CDG→JFK learns from LHR→JFK)
3. **Bayesian updating** of the confidence score as samples arrive
   (currently just a logarithmic curve)
4. **Survival analysis** for "probability the price drops below X in
   the next N days" — proper Kaplan-Meier estimator
5. **Route-level volatility clustering** so the predictor knows that
   Caribbean routes swing ±30% while European intra-schengen routes
   swing ±8%, and tunes confidence thresholds accordingly
6. **Real-time retraining** — replace the on-disk JSON with DuckDB
   and materialize baselines via SQL window functions (~100× faster
   than the current in-memory compute for large datasets)

All of these build on the existing interface — `predictor.ts` returns
the same `Prediction` shape regardless of how it's computed internally.
