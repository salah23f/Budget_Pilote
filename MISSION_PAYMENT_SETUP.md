# Mission Payment Setup — Flyeas

Everything you need to turn on the AI mission payment system end-to-end.
Real money, live mode, zero subscriptions — Stripe is pay-per-transaction
and Base mainnet costs ~$0.01 per on-chain action.

---

## What you're building

Two legally-clean ways to let a user fund an AI travel mission:

| Rail     | Custody                  | Cost                           |
| -------- | ------------------------ | ------------------------------ |
| 💳 Stripe | Non-custodial (manual capture hold) | 2.9% + 30¢ per capture. No sub. |
| 🔗 Wallet | Non-custodial (on-chain USDC escrow) | ~$0.01 gas per tx on Base. No sub. |

Both rails **never** give Flyeas custody of user funds. The user's money
stays in Stripe's authorization system or in a smart contract. We can
only release exact amounts to a whitelisted merchant, and only up to
the user's auto-buy limit (contract-enforced).

---

## 1. Environment variables

Add all of these to `.env.local` for dev and to Vercel → Project → Environment
Variables for production.

### Stripe rail

```env
# Live mode (required for real payments)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Get this from Dashboard → Developers → Webhooks → your endpoint
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Getting the keys:**

1. Create your Stripe account (free): https://dashboard.stripe.com/register
2. Complete business verification (required for live mode, still free)
3. Developers → API keys → reveal **Live** secret + publishable keys
4. Developers → Webhooks → Add endpoint:
   - URL: `https://faregenie.vercel.app/api/webhooks/stripe`
   - Events: `payment_intent.amount_capturable_updated`,
     `payment_intent.succeeded`, `payment_intent.canceled`,
     `payment_intent.payment_failed`
   - Reveal the signing secret → put it in `STRIPE_WEBHOOK_SECRET`

### Wallet rail (USDC on Base mainnet)

```env
NEXT_PUBLIC_ESCROW_CHAIN=base
NEXT_PUBLIC_ESCROW_CHAIN_ID=8453
NEXT_PUBLIC_ESCROW_ADDRESS=0x...            # MissionEscrow deployment
NEXT_PUBLIC_ESCROW_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
NEXT_PUBLIC_ESCROW_MERCHANT=0x...           # Your Flyeas ops wallet
AGENT_PRIVATE_KEY=0x...                     # Backend agent key (server-only, NEVER NEXT_PUBLIC)
ESCROW_RPC_URL=https://mainnet.base.org     # optional — default is fine
```

**Deploying the contract:**

1. Install hardhat or foundry in a separate workspace
2. Compile `contracts/MissionEscrow.sol`
3. Constructor args:
   - `_usdc` = `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`  (USDC on Base)
   - `_agentKey` = address of the backend's signer (derived from `AGENT_PRIVATE_KEY`)
4. Deploy to Base mainnet (~$2-5 one-time gas)
5. After deploy, call `setMerchant(YOUR_OPS_WALLET, true)` once from the owner account to whitelist the merchant
6. Paste the deployed contract address into `NEXT_PUBLIC_ESCROW_ADDRESS`

> The `AGENT_PRIVATE_KEY` account only needs a tiny amount of ETH for
> gas. It **cannot** drain the contract — its only power is to call
> `agentRelease()` up to each mission's `autoBuyLimit`, and only to the
> single whitelisted merchant address.

### Cron + misc

```env
CRON_SECRET=<random-32-bytes>
NEXT_PUBLIC_APP_URL=https://faregenie.vercel.app
```

---

## 2. Install new dependencies

One `npm install` adds Stripe SDKs:

```bash
npm install
```

Packages added to `package.json` in this change:
- `stripe`
- `@stripe/stripe-js`
- `@stripe/react-stripe-js`

Everything else (`viem`, `ethers`, `@privy-io/react-auth`) is already in
the project.

---

## 3. End-to-end flow (what actually happens)

### Stripe rail

```
User → /missions/new → picks "💳 Card" → POST /api/missions/create
      ↓
Server creates Stripe PaymentIntent with capture_method='manual'
      ↓
Redirect to /missions/[id]/pay → Stripe Elements collects card
      ↓
stripe.confirmPayment() → Stripe AUTHORIZES $500 (not charged)
      ↓
Webhook: payment_intent.amount_capturable_updated
      → mission.status = 'monitoring'
      ↓
Cron fires /api/missions/[id]/propose every 6 hours
      → searchFlights() → cheapest < auto-buy threshold?
          ├─ YES → paymentIntent.capture({ amount_to_capture: 380 })
          │        → Stripe charges $380, releases $120 back to card
          │        → mission.status = 'booked'
          │        → show Kiwi deep-link on cockpit
          └─ NO  → create MissionProposal, user confirms in cockpit
```

### Wallet rail

```
User → /missions/new → picks "🔗 Wallet" → POST /api/missions/create
      ↓
Server returns deposit calldata
      ↓
/missions/[id]/pay → user signs USDC.approve(escrow, 500)
      → user signs MissionEscrow.deposit(id, 500, 400, expiresAt)
      ↓
Frontend POSTs /api/missions/[id]/confirm-deposit with tx hash
      → server reads MissionEscrow.getMission() to verify
      → mission.status = 'monitoring'
      ↓
Cron → /api/missions/[id]/propose → cheapest < auto-buy?
      ├─ YES → agentReleaseOnChain() → USDC flows to merchant
      │         → mission.status = 'booked'
      └─ NO  → create proposal, user confirms (second on-chain tx)
```

---

## 4. Testing checklist

Once your env vars are set:

### Stripe rail — with real card, no charge

1. Go to `/missions/new`, pick "💳 Card"
2. Set budget $50, auto-buy $45
3. Enter a real card on the pay page
4. Confirm hold — verify in Stripe Dashboard that a PaymentIntent with status `requires_capture` appears
5. Go to the cockpit, click "🔍 Check now"
6. If the agent finds a sub-$45 flight: the capture happens automatically and the remainder is released
7. Click "Cancel mission" on a fresh mission → Stripe shows the PI canceled, card is never charged

### Wallet rail — on Base mainnet

1. Put ~$5 USDC + $2 ETH on your Base wallet
2. Go to `/missions/new`, pick "🔗 Wallet"
3. Set budget $3, auto-buy $2
4. Connect wallet on the pay page, approve + deposit
5. Verify on BaseScan that `MissionEscrow.MissionCreated` fired
6. Click "Check now" on the cockpit. If a matching offer is found, BaseScan will show `MissionRelease` emitted

---

## 5. Security checklist before going live

- [ ] `AGENT_PRIVATE_KEY` is NOT prefixed with `NEXT_PUBLIC_` (it must be server-only)
- [ ] `STRIPE_SECRET_KEY` starts with `sk_live_`
- [ ] `STRIPE_WEBHOOK_SECRET` matches the live webhook endpoint, not test
- [ ] Webhook endpoint is registered in Stripe Dashboard for the LIVE environment
- [ ] Your `NEXT_PUBLIC_ESCROW_MERCHANT` address is a multisig you actually control
- [ ] You have called `MissionEscrow.setMerchant(merchant, true)` once from the owner
- [ ] `CRON_SECRET` is set (prevents public cron abuse)
- [ ] You have tested at least one real end-to-end capture + release on each rail

---

## 6. What's next (post-MVP)

These are natural follow-ups once the two rails are live:

1. **Kiwi Tequila Partner** — upgrade from deep-link handoff to a true
   booking API. Kiwi Partner Hub takes days, not weeks, to approve and
   keeps the same legal model. When active, `bookingDeepLink` becomes
   an internal booking reference instead of a URL.

2. **Price insight badge** — show "X% below route average" on proposals
   so users feel confident about confirming.

3. **Deal alerts** — email + push when a watched mission's `bestSeenPrice`
   drops meaningfully below the previous check.

4. **Mission history + analytics** — show the user their lifetime savings
   from auto-buys versus average market price.

5. **Multi-leg missions** — same escrow, single budget, multiple
   legs (Paris → Rome → Barcelona).

6. **Refund flow** — post-capture refunds for booking failures (Stripe
   `refunds.create`, on-chain `withdraw` after failed booking).
