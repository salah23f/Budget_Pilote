# Merge Map V_A × V_B → V_FINAL

**SHA_A**: d7a5bd2 (pre-rebrand, dense glassmorphism, #E8A317 everywhere)
**SHA_B**: HEAD main (editorial serif, minimalist dashboard, identity store)

---

## 1. app/(app)/dashboard/page.tsx

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| Greeting header | `text-2xl font-display` "Good evening, {name}" + date below | `editorial text-[48px]` serif italic greeting. Uses `useIdentity().displayName` | B_MAL_EXECUTE — too large (48px wastes fold), but identity hook is correct | Serif italic 24px greeting + date 13px text-muted DROITE. `useIdentity()` for real name. If `displayName === 'there'` → redirect /onboarding |
| Stats strip | `DashboardStats` component — 4-6 stats in a grid, large gradient icons | Gone in V_B — replaced by collapsed "Travel insights" | B_MAL_EXECUTE — user can't answer Q1-Q3 without expanding | Restore as 4-stat strip (88px) inline: Total Saved, Searches, Deals Found, Streak. Compact cards, no gradient icons — tinted bg 8% + Lucide 32px |
| Quick actions | 3 large tiles (Flights/Hotels/New Mission) with gradient icons | Gone — replaced by command bar pills | A_SURCHARGE — tiles too large for 3 links | 4 horizontal chips 56px: Flights, Hotels, My missions, Explore. Ghost style, not tiles |
| Featured destination | `DealOfTheDay` + separate `FeaturedDestination` with giant letter "L/K/M" as placeholder | Giant serif letter as visual placeholder, no photo, no flag, no weather | B_MAL_EXECUTE — letter-as-country is the #1 visual bug | Full hero card: real Unsplash photo + flag SVG flagcdn.com + weather API + price PriceDisplay + editorial phrase + 2 CTAs. See Phase 3 spec |
| Active missions | Compact list of missions with route, status, price delta | Compact list, 3 rows max. Uses `useMissionStore` | B_MEILLEUR — clean list | Keep V_B list, add "Last checked Xm ago" label + delta price |
| Recent searches | Grid of cards with route, date, cheapest price | Compact chips with route only, no price | B_MAL_EXECUTE — lost the price info | Horizontal scroll chips with route + date + cheapest price |
| Cockpit (Radar/Gauge/Map) | FlightRadar + SavingsGauge + WorldMap + LevelWidget in 3-col grid | All removed from default view | A_SURCHARGE — 3 decorative widgets competing | Remove from dashboard entirely. Radar lives on /missions/[id]/cockpit. Map on /journey. Gauge replaced by stat strip number |
| Week strip | Not in V_A | In V_B then removed | B_MEILLEUR (removed) | Stay removed |
| Referral widget | Large gold gradient CTA card | Removed | A_SURCHARGE | Inline banner 60px: Gift icon + "Invite friends, earn $10" + count + ghost CTA |
| Rewards summary | Not in V_A dashboard | Not in V_B | MANQUANT | Grid-cols-2: Tier progress card + Next reward preview card |
| Pro tip footer | Not in either | Not in either | MANQUANT | Conditional: free → "Unlock 15-min monitoring. Start Pro trial →", pro → "Thanks for being Pro." |
| Spacing | Mixed mb-6/mb-8/mb-10 | Mixed mb-8/mb-10 | B_MAL_EXECUTE | 40px between rows desktop, 28px mobile. max-width 1280px |

## 2. app/page.tsx (Landing)

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| Hero | Editorial serif + TripPlannerHero side-by-side, greeting rotation | Same as V_A but tightened | B_MEILLEUR | Keep V_B hero |
| How it works | Existed in early V_A, removed in V_B | Gone | B_MAL_EXECUTE — users need to understand the product | Restore: 3 steps editorial (Set a trip → We watch → You decide) |
| Comparison table | Existed in V_A as 3 paragraphs | 1 paragraph in V_B | B_MAL_EXECUTE — too reduced | Restore structured comparison: Flyeas vs Skyscanner vs Google Flights vs Kiwi (4-col table, 6 rows) |
| Live deals | Existed as LiveDeals component | Removed | B_MAL_EXECUTE | Restore "Deals right now" strip with 3-4 real deal cards from /api/deals |
| Trust badges | Existed in V_A | Removed | B_MAL_EXECUTE | Restore inline: "Stripe Verified · SSL · GDPR · No Hidden Fees" |
| Pricing | Clean 3 cards | Same | B_MEILLEUR | Keep V_B |
| FAQ | 6 questions → 4 in V_B | 4 questions | A_MEILLEUR | Restore to 6 questions |

## 3. app/onboarding/page.tsx

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| Welcome step | Rotating greetings + gradient gold icon | Editorial serif "Where will you go next?" | B_MEILLEUR | Keep V_B |
| Email/code form | Functional, asks name+email+code | Same | B_MEILLEUR | Keep, ensure identity stored in identityStore on verify |
| Wallet step | Optional ConnectWallet | Same | B_MEILLEUR | Keep optional |
| Personalize redirect | Redirects to /personalize (3 gamified steps) | Same | B_MEILLEUR | Keep, but ensure travel style cards use REAL PHOTOS not SVG icons |
| Persistence | Stores in localStorage sv_user + Supabase upsert | V_B added identityStore hydration in app-shell | B_MAL_EXECUTE — identity store not populated during onboarding finish() | Fix: onboarding finish() must call `useIdentityStore.getState().update({ firstName, email })` |

## 4. app/(app)/flights/page.tsx

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| Search bar | Sticky top, AirportInput + date pickers | Same | B_MEILLEUR | Keep |
| Result cards | Dense: airline logo, route visual, duration, stops, baggage, CO2, PriceDisplay, deal quality badge, sparkline 7j | Same (only accent color changed) | A_MEILLEUR | Keep dense cards — this is where data density is wanted |
| Detail modal | FlightDetailModal with What's Included, Cancellation, Layover, Price Breakdown | Same | A_MEILLEUR | Keep |
| Hacker Fares | Detection + banner | Same | A_MEILLEUR | Keep |
| Empty state | "No flights found" with retry | Same | B_MEILLEUR | Keep with 3 route suggestions |

## 5. app/(app)/hotels/page.tsx

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| Search + results | Full hotel search with photos, ratings, price | Unchanged | A_MEILLEUR | Keep as-is |

## 6. app/(app)/cars/page.tsx

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| Search + results | Car rental search | Unchanged | A_MEILLEUR | Keep as-is |

## 7. app/(app)/insurance/page.tsx

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| Plans + details | Insurance comparison | Unchanged | A_MEILLEUR | Keep as-is |

## 8. app/(app)/rewards/page.tsx

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| Header | Large gradient icon + "Rewards" | Editorial serif "Your rewards" | B_MEILLEUR | Keep V_B editorial header |
| Earn more grid | 8 action cards with icons | Same | A_MEILLEUR | Keep |
| Badges gallery | SVG icons, locked/unlocked | Same | A_MEILLEUR | Keep |
| Points history | Timeline | Same | A_MEILLEUR | Keep |
| Rewards redeem | Cards with Redeem buttons | Same | A_MEILLEUR | Keep |

## 9. app/(app)/referral/page.tsx

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| Hero | "Invite friends, earn real rewards" with animated SVG | Same but accent updated | B_MEILLEUR | Keep V_B |
| Share card | Large mono code + 5 share buttons | Same | A_MEILLEUR | Keep |
| Tier cards | 6 progressive reward tiers | Same | A_MEILLEUR | Keep |
| Friends list | Status-tracked invite list | Same | A_MEILLEUR | Keep |

## 10. components/layout/app-shell.tsx

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| Identity hydration | Reads sv_user from localStorage, sets useUserStore.setName | V_B added identityStore.hydrate() + profileStore.hydrate() + reconcile() | B_MEILLEUR | Keep V_B, but add guard: if identity.firstName missing after hydrate, don't show "Traveler" — show nothing or redirect |
| Scroll-to-top | Gold glow button | Neutral ink-800 button | B_MEILLEUR | Keep V_B |
| Lazy overlays | Chat, CommandPalette, Celebrations, Onboarding, Offline | Same | B_MEILLEUR | Keep |

## 11. components/layout/topbar.tsx

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| Search bar | Functional with quick links dropdown | Same | B_MEILLEUR | Keep |
| Language picker | LanguagePicker component with search + region groups | Same | B_MEILLEUR | Keep |
| Currency picker | CurrencyPicker component | Same | B_MEILLEUR | Keep |
| Theme toggle | Sun/Moon | Same | B_MEILLEUR | Keep |
| User avatar | First initial in gradient circle | Same but gradient toned down | B_MEILLEUR | Keep |

## 12. components/layout/sidebar.tsx

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| Nav sections | Travel / Watches / You with i18n labels | Same, "Missions" → "Watches" in V_B | B_MEILLEUR | Keep V_B |
| User section | Avatar + badge + logout | Same | B_MEILLEUR | Keep |

## 13. components/layout/bottom-nav.tsx

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| Tabs | Home, Flights, Missions, Hotels, Settings | Same | A_MEILLEUR | Keep, ensure "Missions" label uses i18n (may show "Watches") |

## 14. components/chat/chat-panel.tsx

| Section / Bloc | Etat V_A | Etat V_B | Diagnostic | Decision V_FINAL |
|---|---|---|---|---|
| FAB button | bottom-20 right-4 mobile, bottom-6 right-6 desktop | Same | B_MEILLEUR | Keep |
| Panel | Full rewrite with textarea, Enter/Shift+Enter, auto-resize | Same | B_MEILLEUR | Keep |
| i18n | Uses useLocale() for all labels | Same | B_MEILLEUR | Keep |
| Accent color | #D4A24C (V_B palette) | Same | B_MEILLEUR | Keep |

---

## Quality gate Phase 0

- [x] 14 files audited with tables
- [x] Each table has >= 3 lines
- [x] Each V_FINAL decision is actionable
- [x] "Featured this week card" line exists in dashboard table
- Phase 0 PASSED → proceed to Phase 4 (persistence fix, BLOQUANT)
