# BudgetPilot Live Status

## What is already done
- Next.js app structure updated
- World Mini App provider added
- Privy OTP login component added
- Onchain booking button added using `useSendTransaction`
- In-memory shared store fixed for API routes
- Hardhat config and Ignition deploy module added
- Solidity receipt contract updated
- The Graph subgraph schema, mappings, and config updated for OP Sepolia
- `.env.example` added

## What still needs real credentials to complete end-to-end
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_RECEIPT_CONTRACT`
- `OP_SEPOLIA_RPC_URL`
- `DEPLOYER_PRIVATE_KEY`
- `SUBGRAPH_QUERY_URL`

## What I could not fully verify inside this container
- `npm install` / full `next build` completion
- Real Privy login flow
- Real World App runtime flow
- Real onchain transaction submission
- Real Hardhat deployment
- Real The Graph deployment

## First commands to run on your machine
```bash
npm install
cp .env.example .env.local
npm run dev
```

## Then
1. Fill `.env.local`
2. Deploy contract with Hardhat
3. Put contract address into `.env.local`
4. Create and deploy the subgraph
5. Test login + mission creation + onchain booking
