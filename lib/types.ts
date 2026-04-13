// User
export type KycStatus = 'pending' | 'submitted' | 'verified' | 'rejected';
export type AuthMethod = 'email' | 'wallet' | 'social' | 'privy';

export interface UserProfile {
  id: string;
  privyId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  walletAddress?: string;
  walletChain?: string;
  kycStatus: KycStatus;
  kycDocumentUrl?: string;
  avatarUrl?: string;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  defaultCurrency: 'USD' | 'EUR' | 'GBP';
  preferredAirlines: string[];
  cabinClass: CabinClass;
  ecoPreference: 'cheapest' | 'balanced' | 'greenest';
  notificationsEmail: boolean;
  notificationsPush: boolean;
  autoPayEnabled: boolean;
  preferredChainId: number;
}

// Mission
export type MissionStatus =
  | 'draft'
  | 'awaiting_payment'   // user created it but hasn't funded the hold yet
  | 'monitoring'         // funds are held, agent is watching
  | 'proposal_pending'   // agent found an offer above auto-buy; waiting for user
  | 'booked'             // funds captured and booking link delivered
  | 'completed'          // trip actually happened (post-flight)
  | 'cancelled'          // user cancelled, hold released
  | 'expired';           // hold expired without a matching offer

export type MissionType = 'flight' | 'hotel' | 'package';
export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';
export type StopsPreference = 'any' | 'nonstop' | 'max1';

/**
 * Payment rail — two legally-safe options that avoid money transmitter
 * classification:
 *
 *  - 'stripe':  Stripe PaymentIntent with capture_method='manual'. Card is
 *               AUTHORIZED but not charged. On agent-found offer we capture
 *               only the actual price; remainder is released to the card
 *               automatically. No custody of funds.
 *
 *  - 'wallet':  User deposits USDC into a MissionEscrow smart contract.
 *               Backend agent can only release up to autoBuyLimit to
 *               whitelisted merchant addresses. User retains full custody
 *               via their private key. Non-custodial.
 */
export type PaymentRail = 'stripe' | 'wallet';

export type MissionPaymentStatus =
  | 'none'         // no payment rail attached
  | 'authorized'   // Stripe hold in place OR USDC deposited in escrow
  | 'captured'     // funds captured / released to merchant
  | 'refunded'     // hold released back to user
  | 'cancelled';   // authorization cancelled

export interface Mission {
  id: string;
  userId: string;
  type: MissionType;
  origin: string;
  originCity?: string;
  destination: string;
  destinationCity?: string;
  departDate: string;
  returnDate?: string;
  passengers: number;
  maxBudgetUsd: number;
  /**
   * Price threshold under which the agent auto-buys without asking the
   * user. Must be <= maxBudgetUsd. If null/undefined, the user gets a
   * proposal for every matching offer.
   */
  autoBuyThresholdUsd?: number;
  cabinClass: CabinClass;
  cabinBagRequired: boolean;
  stopsPreference: StopsPreference;
  preferredAirlines: string[];
  ecoPreference: string;
  monitoringEnabled: boolean;
  alertEmailEnabled: boolean;
  status: MissionStatus;
  bestSeenPrice?: number;
  bestSeenCarbonKg?: number;
  lastCheckedAt?: string;
  budgetDepositedUsd: number;
  budgetPoolTxHash?: string;
  chainId?: number;

  // ------------------------------------------------------------------
  // Payment rail fields — set at mission creation time
  // ------------------------------------------------------------------
  paymentRail?: PaymentRail;
  paymentStatus?: MissionPaymentStatus;

  // Stripe rail
  stripePaymentIntentId?: string;
  stripeClientSecret?: string;
  stripeAuthorizedAmount?: number; // cents
  stripeCapturedAmount?: number;   // cents (after capture)
  stripeExpiresAt?: string;        // ISO — auth expires ~7 days from creation

  // Wallet rail
  walletUserAddress?: string;      // 0x... of the depositor
  walletEscrowId?: string;         // bytes32 id used in the contract
  walletEscrowTxHash?: string;     // deposit tx hash
  walletReleaseTxHash?: string;    // release tx hash (after capture)
  walletChain?: 'base' | 'optimism' | 'arbitrum' | 'polygon';

  createdAt: string;
  updatedAt: string;
}

/**
 * A proposal is what the agent sends the user when it finds an offer
 * that matches the mission AND sits between autoBuyThreshold and budget.
 * If the agent finds an offer <= autoBuyThreshold it skips the proposal
 * and auto-buys immediately.
 */
export type MissionProposalStatus =
  | 'pending'      // waiting for user decision
  | 'confirmed'    // user confirmed, capture in progress
  | 'declined'     // user said no, keep watching
  | 'auto_bought'  // agent bought it without asking (price <= threshold)
  | 'expired';     // user didn't respond in time

export interface MissionProposal {
  id: string;
  missionId: string;
  offerId: string;
  offerSnapshot: {
    airline: string;
    airlineCode?: string;
    logoUrl?: string;
    priceUsd: number;
    originIata?: string;
    destinationIata?: string;
    departureTime?: string;
    arrivalTime?: string;
    durationMinutes: number;
    stops: number;
    deepLink?: string;
  };
  status: MissionProposalStatus;
  reason: string;                  // why the agent chose this offer
  captureAmountCents?: number;     // how much was captured (stripe rail)
  captureTxHash?: string;          // on-chain release tx (wallet rail)
  bookingDeepLink?: string;        // Kiwi URL to complete the purchase
  createdAt: string;
  confirmedAt?: string;
  expiresAt: string;               // proposals auto-expire after N hours
}

// Offer
export type OfferSource = 'amadeus' | 'mock' | 'booking' | 'airbnb';
export type OfferLabel = 'best_value' | 'cheapest' | 'fastest' | 'greenest' | 'recommended';
export type DealQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface Offer {
  id: string;
  missionId: string;
  source: OfferSource;
  externalId?: string;
  // Flight-specific
  airline?: string;
  airlineCode?: string;
  flightNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
  durationMinutes?: number;
  stops?: number;
  cabinClass?: CabinClass;
  baggageIncluded?: boolean;
  // Hotel-specific
  hotelName?: string;
  hotelRating?: number;
  amenities?: string[];
  photos?: string[];
  locationLat?: number;
  locationLng?: number;
  checkIn?: string;
  checkOut?: string;
  roomType?: string;
  // Common
  priceUsd: number;
  originalCurrency?: string;
  originalPrice?: number;
  carbonKg?: number;
  score?: number;
  dealQuality?: DealQuality;
  label?: OfferLabel;
  explanation?: string;
  rawData?: any;
  fetchedAt: string;
}

// Booking
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'failed' | 'refunded';
export type PaymentMethod = 'crypto' | 'fiat';

export interface Booking {
  id: string;
  missionId: string;
  userId: string;
  offerId: string;
  bookingRef?: string;
  status: BookingStatus;
  paymentMethod?: PaymentMethod;
  paymentTxHash?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  chainId?: number;
  receiptTxHash?: string;
  receiptCid?: string;
  bookedAt: string;
  offer?: Offer;
}

// Price History
export interface PriceHistoryEntry {
  id: string;
  missionId: string;
  minPrice: number;
  avgPrice: number;
  maxPrice: number;
  offerCount: number;
  checkedAt: string;
}

// Notifications
export type NotificationType = 'price_alert' | 'auto_buy' | 'recommendation' | 'system' | 'booking_confirmed';

export interface Notification {
  id: string;
  userId: string;
  missionId?: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

// Chat
export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  userId: string;
  missionId?: string;
  role: ChatRole;
  content: string;
  metadata?: any;
  createdAt: string;
}

// Transactions
export type TransactionType = 'deposit' | 'withdrawal' | 'payment' | 'refund';
export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

export interface Transaction {
  id: string;
  userId: string;
  missionId?: string;
  type: TransactionType;
  amount: number;
  currency: string;
  chainId?: number;
  txHash?: string;
  status: TransactionStatus;
  createdAt: string;
}

// Agent Decision
export type AgentAction = 'WAIT' | 'RECOMMEND' | 'AUTO_BUY';

export interface AgentDecision {
  missionId: string;
  selectedOfferId?: string;
  action: AgentAction;
  confidence: number; // 0-100
  reason: string;
  pricePercentile?: number;
  predictedTrend?: 'rising' | 'stable' | 'falling';
  timestamp: string;
}

// Market Signal
export interface MarketSignal {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  pricePercentile: number;
  trend: 'rising' | 'stable' | 'falling';
  daysUntilDeparture: number;
  historicalAvg30d?: number;
  volatility?: number;
}

// Chain Config
export interface ChainConfig {
  id: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  explorerUrl: string;
  usdcAddress: string;
  budgetPoolAddress?: string;
  receiptAddress?: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  cabinClass?: CabinClass;
  maxPrice?: number;
  nonStop?: boolean;
}

export interface HotelSearchParams {
  cityCode: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
  maxPrice?: number;
  rating?: number;
}

// Legacy alias for backward compatibility with existing store.ts
export type Decision = AgentDecision;
