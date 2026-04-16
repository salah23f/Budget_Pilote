# Flyeas Design System v2

**Reference**: Emirates First Class, Singapore Airlines, Aman Resorts, Airbnb Plus, Revolut Metal, Away luggage, Monocle magazine.

**Philosophy**: Flyeas is a travel brand that uses AI as an invisible tool — not a tech product that happens to do travel. Everything must feel editorial, confident, quietly luxurious. Never "Silicon Valley glassy", never generic gradients, never AI-speak.

---

## 1. Color Palette

### Background & surfaces

Warm off-black base (not pure #000 — pure black feels cheap on OLED).

| Token | Hex | Usage |
|-------|-----|-------|
| `--ink-950` | `#0B0B0D` | App background, body |
| `--ink-900` | `#111114` | Sidebar, sticky topbar |
| `--ink-800` | `#17171B` | Elevated surface 1 (cards on app bg) |
| `--ink-700` | `#1D1D22` | Elevated surface 2 (modals, panels) |
| `--ink-600` | `#26262C` | Elevated surface 3 (hover states) |
| `--ink-500` | `#32323A` | Inputs, dividers |

### Borders

Three levels — no more transparent white overlays.

| Token | Hex | Usage |
|-------|-----|-------|
| `--line-1` | `#1A1A1D` | Subtle, default card border |
| `--line-2` | `#252528` | Interactive, hover state |
| `--line-3` | `#2F2F34` | Strong, focused inputs |

### Text

Two tones. Three at most. Never low-contrast mystery text.

| Token | Hex | Usage |
|-------|-----|-------|
| `--text-1` | `#F5F5F1` | Headlines, primary body |
| `--text-2` | `#A9A9A4` | Secondary copy, metadata |
| `--text-3` | `#6E6E68` | Muted, timestamps, captions |

### Accent — used sparingly (5–10% of screen area)

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#D4A24C` | Single primary accent — CTAs, active states, brand signature only |
| `--accent-soft` | `rgba(212,162,76,0.12)` | Rare — only for active nav indicator, tier pills |

**Removed**: `--flyeas-accent: #E8A317` (too saturated), `--flyeas-accent-light`, `--flyeas-accent-dark`, all `#F97316` gradients, all `linear-gradient(135deg, #E8A317, #F97316)` usages.

### Semantic

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#4F8A6E` | Positive states (deal, saved) |
| `--success-soft` | `rgba(79,138,110,0.12)` | Backgrounds |
| `--danger` | `#A14848` | Errors, negative |
| `--danger-soft` | `rgba(161,72,72,0.12)` | Error backgrounds |
| `--warning` | `#B8893C` | Warnings (rare) |

**Hard rule**: no rainbow gradients. The most we allow is `linear-gradient(180deg, var(--ink-800), var(--ink-900))` for tall cards, nothing more.

---

## 2. Typography

### Families

- **Serif (editorial)**: `Fraunces` — hero headlines, greeting, section intros, tier names, editorial moments. Weight 400 for body serif, 500 for display.
- **Sans (UI)**: `Inter` — all interactive UI, body copy, labels.
- **Display sans (legacy kept)**: `Plus Jakarta Sans` — only for the logo wordmark now. No other use.
- **Mono (data)**: `ui-monospace, 'SF Mono', Menlo, monospace` — prices, codes, timestamps only.

### Type scale — strict 6 sizes + logo

| Token | Size | Line height | Use |
|-------|-----|---------|-----|
| `display` | 48 / 56px | 1.05 | Editorial hero (serif) |
| `h1` | 32 / 36px | 1.15 | Page titles (serif or sans) |
| `h2` | 22 / 24px | 1.25 | Section heads |
| `body-lg` | 16px | 1.55 | Primary body |
| `body` | 14px | 1.5 | Default body |
| `caption` | 12px | 1.4 | Metadata, captions |
| `micro` | 10.5px / tracking 0.08em uppercase | 1.3 | Eyebrows, tags |

Forbidden: `text-[11px]`, `text-[13px]`, `text-[9px]`, `text-[15px]`. Pick from the scale.

### Letter-spacing

- Serif display: `-0.02em` (tight, confident)
- Sans headlines: `-0.01em`
- Body: `0`
- Uppercase eyebrows/tags: `+0.08em`

---

## 3. Spacing grid

Strict 4px base. Only these values:

| Token | px |
|-------|-----|
| `0.5` | 2 |
| `1` | 4 |
| `2` | 8 |
| `3` | 12 |
| `4` | 16 |
| `5` | 20 |
| `6` | 24 |
| `8` | 32 |
| `10` | 40 |
| `12` | 48 |
| `16` | 64 |
| `20` | 80 |
| `24` | 96 |

Forbidden: `mb-3.5`, `p-7`, `gap-9`. Pick from the scale.

### Container widths

- `prose`: 640px (editorial reading)
- `content`: 960px (standard app)
- `wide`: 1200px (landing hero, marketing)
- `max`: 1440px (full-width marketing only)

### Section padding

- Mobile: 24px horizontal, 48px vertical between sections
- Desktop: 48px horizontal, 96px vertical between sections

---

## 4. Elevation system

No more heavy blur-glass everywhere. Three subtle levels only.

| Level | Background | Border | Shadow |
|-------|------------|--------|--------|
| 0 — flat | `var(--ink-950)` | none | none |
| 1 — card | `var(--ink-800)` | `1px solid var(--line-1)` | none |
| 2 — hover | `var(--ink-700)` | `1px solid var(--line-2)` | `0 1px 0 rgba(0,0,0,0.2) inset` |
| 3 — modal | `var(--ink-700)` | `1px solid var(--line-2)` | `0 24px 48px -12px rgba(0,0,0,0.5)` |

**Glassmorphism rule**: ONLY on the sticky topbar (`backdrop-filter: blur(18px)` + `background: rgba(17,17,20,0.72)`). Nowhere else.

---

## 5. Border radius

Reduce from 5 sizes to 4. Stop using rounded-2xl/3xl on everything.

| Token | px | Use |
|-------|-----|-----|
| `sm` | 6px | Inputs, pills, chips |
| `md` | 10px | Buttons, small cards |
| `lg` | 14px | Large cards, panels |
| `xl` | 20px | Hero cards, editorial blocks |

---

## 6. Voice & tone

### Five principles

1. **Specific over smart.** "Monitored 4,812 flights for you this week" beats "AI-powered price tracking".
2. **Warm but confident.** We're not your excited friend, we're your senior concierge.
3. **Zero AI-speak.** No "Powered by AI", "Smart", "Intelligent", "Revolutionary", "Unleash".
4. **No emojis in copy.** Lucide icons only. If a sentence needs an emoji to feel fun, the sentence is wrong.
5. **Short, declarative, specific.** Verbs in the active voice. Numbers where possible.

### Ten replacement examples

| Before | After |
|--------|-------|
| "Smart Travel Simplified" | "Watch prices. Book on your terms." |
| "AI-powered travel agent" | "Your travel concierge. Live data, 24 hours a day." |
| "Unleash the AI" | "Let the mission run." |
| "Revolutionary price prediction" | "We've tracked this route for 180 days." |
| "Get started today!" | "Start your first mission" |
| "Let's go" | "Begin" |
| "Welcome back!" | "Welcome back, {name}." (no exclamation) |
| "No flights found 😔" | "No routes match those dates. Try ±3 days." |
| "Oops something went wrong" | "That didn't load. Try again, or check your connection." |
| "Upgrade now" | "Go Pro — $9/month" |

---

## 7. Animation philosophy

Animations are purposeful. Never decorative.

### Timing curves

- **Default ease** (most things): `cubic-bezier(0.4, 0, 0.2, 1)` — 160ms
- **Entrance** (modals, panels, toasts): `cubic-bezier(0.16, 1, 0.3, 1)` — 280ms
- **Exit** (dismissals): `cubic-bezier(0.4, 0, 1, 1)` — 160ms
- **Data counts** (prices, stats): cubic easeOut — 400–800ms

### Rules

- Button press: `scale(0.98)` on active. Nothing else.
- Card hover: `translateY(-1px)` + border color change. Never scale, never shadow expand.
- Page transitions: fade only, 200ms. No slide.
- No infinite loops except live-data indicators (radar sweep, pulse dot).
- Reduced-motion: all non-essential animations off.

---

## 8. The Do-NOT list

1. **Never** stack two gradients.
2. **Never** use `linear-gradient` longer than 2 stops except for ambient ink-to-ink.
3. **Never** put a `box-shadow: 0 0 Xpx accent` glow on anything. Glow is Silicon Valley tell.
4. **Never** use `backdrop-filter: blur()` except on the sticky topbar.
5. **Never** center-align body text longer than 80 characters.
6. **Never** use more than 2 font families simultaneously.
7. **Never** use rounded-full on anything that isn't a pill, avatar, or dot.
8. **Never** put icons inside colored gradient circles (replace with subtle ink surface).
9. **Never** use emojis in UI copy, labels, or error states.
10. **Never** use "Smart", "Intelligent", "AI-powered", "Revolutionary", "Unleash" in copy.

---

## 9. Component elevation guide

- **Primary button**: solid `--accent` background, `--ink-950` text, `borderRadius: md`, no shadow, no glow.
- **Secondary button**: `--ink-800` bg, `--text-1` fg, `1px solid --line-2` border.
- **Ghost button**: transparent bg, `--text-2` fg, hover bg `--ink-800`.
- **Card**: `--ink-800` bg, `1px solid --line-1` border, `borderRadius: lg`, padding `24px` (6).
- **Input**: `--ink-900` bg, `1px solid --line-1`, focus ring `--line-3`, no glow.
- **Sticky topbar**: `background: rgba(17,17,20,0.72)`, `backdrop-filter: blur(18px)`, `border-bottom: 1px solid --line-1`.
- **Modal**: `--ink-700` bg, `--line-2` border, `borderRadius: xl`, shadow level 3.
- **Toast**: same as modal but smaller, slides from top-right.
- **Tag / chip**: `--ink-800` bg, `--text-2` fg, `borderRadius: sm`, no border.

---

## 10. Migration plan

- Replace every `#E8A317` with `var(--accent)` = `#D4A24C`.
- Delete every `linear-gradient(135deg, #E8A317, #F97316)` — replace with solid `var(--accent)` for buttons, `var(--ink-800)` for surfaces.
- Delete every `box-shadow: 0 0 Xpx rgba(232,163,23, Y)` — replace with nothing, or level-3 shadow for modals only.
- Remove `backdrop-filter: blur()` from everything except the topbar.
- Replace every hardcoded `text-[11px]`, `text-[13px]` etc. with the 6 type tokens.
- Import Fraunces in `app/layout.tsx`. Use `font-serif` class for editorial moments.

---

*Keep this file updated when we evolve the system. Changes require design review.*
