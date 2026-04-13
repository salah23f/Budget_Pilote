# BudgetPilot Starter

A hackathon-ready starter for a travel booking AI + wallet demo.

## Stack
- Next.js 15 + React
- Mock in-memory store for speed
- Solidity receipt contract
- Simple scoring + decision engine

## Install
```bash
pnpm install
pnpm dev
```

## Environment
Create `.env.local`:
```bash
NEXT_PUBLIC_APP_NAME=BudgetPilot
OPENAI_API_KEY=your_key_here
```

## What it does
- Create a mission
- Score mocked flight offers
- Show recommended option
- Simulate agent monitoring and autobuy decision
- Mint a simple onchain receipt event with the Solidity contract

## Notes
- Replace the mock offer provider with a real API only if you have time.
- Add Privy / World / Self after the UI and scoring are solid.
