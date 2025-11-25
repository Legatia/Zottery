/**
 * Shared types for Zottery anonymous lottery system
 */

// ============================================================================
// Lottery Configuration
// ============================================================================

export const LOTTERY_CONFIG = {
  NUMBERS_PER_TICKET: 5,
  MIN_NUMBER: 1,
  MAX_NUMBER: 32,
  MIN_MATCHES_FOR_PRIZE: 3,
  TICKET_PRICE: 1, // ZEC

  // Prize distribution (percentage of pool)
  PRIZE_DISTRIBUTION: {
    PRIZES: 0.75, // 75% to prizes
    ROLLOVER: 0.20, // 20% to next draw
    OPERATIONS: 0.05, // 5% operations
  },

  // Prize tiers (percentage of prize pool)
  // Prize tiers (percentage of prize pool) - Legacy/Pure Lottery
  PRIZE_TIERS: {
    5: 0.60, // 60% for 5/5 matches
    4: 0.20, // 20% for 4/5 matches
    3: 0.15, // 15% for 3/5 matches
  },

  // Yield-at-Risk Multipliers
  YIELD_MULTIPLIERS: {
    JACKPOT: 50, // 5/5 Ordered
    TIER_2: 10,  // 5/5 Any Order
    TIER_3: 5,   // 4/5 Any Order
    TIER_4: 1,   // 3/5 Any Order
  }
} as const;

// ============================================================================
// Core Data Models
// ============================================================================

/**
 * Represents a lottery ticket in the registry
 */
export interface Ticket {
  ticketHash: string;        // SHA256(numbers || salt || claim_key)
  numbers: number[];         // Array of 6 numbers (1-49)
  salt: string;              // Random salt for hash uniqueness
  drawId: number;            // Which draw this ticket belongs to
  purchaseAmount: number;    // Amount paid in ZEC
  purchaseTxId: string;      // Zcash transaction ID for purchase
  createdAt: Date;           // Timestamp of ticket creation
}

/**
 * Represents a lottery draw
 */
export interface Draw {
  drawId: number;
  winningNumbers: number[];  // Array of 6 winning numbers (1-49)
  drawDate: Date;           // When the draw occurred
  salesCloseDate: Date;     // When ticket sales close
  ticketsSold: number;      // Total number of tickets sold
  prizePool: number;        // Total ZEC in prize pool
  vrfProof?: string;        // Verifiable randomness proof
  status: DrawStatus;
  prizesDistributed: PrizeDistribution;
}

export type DrawStatus = 'open' | 'closed' | 'drawn' | 'completed';

export interface PrizeDistribution {
  match5: { winners: number; amountEach: number };
  match4: { winners: number; amountEach: number };
  match3: { winners: number; amountEach: number };
}

/**
 * Represents a prize claim
 */
export interface Claim {
  claimId: string;
  nullifier: string;         // Unique nullifier derived from claim_key
  drawId: number;
  prizeMatches: number;      // Number of matches (3-6)
  prizeAmount: number;       // Prize amount in ZEC
  zkProof: ZKProof;          // Zero-knowledge proof
  recipientAddress: string;  // Shielded z-address
  payoutTxId?: string;       // Zcash transaction ID for payout
  status: ClaimStatus;
  claimedAt: Date;
  paidOutAt?: Date;
}

export type ClaimStatus = 'pending' | 'verified' | 'paid' | 'rejected';

/**
 * Zero-knowledge proof data structure
 */
export interface ZKProof {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to purchase a ticket
 */
export interface PurchaseTicketRequest {
  numbers?: number[];        // Optional: user-selected numbers
  txId: string;             // Zcash transaction ID proving payment
  fromAddress: string;      // Transparent address that sent payment
}

export interface PurchaseTicketResponse {
  success: boolean;
  ticket?: {
    ticketHash: string;
    numbers: number[];
    salt: string;
    claimKey: string;        // Private! User must save this securely
    drawId: number;
  };
  error?: string;
}

/**
 * Request to get ticket information
 */
export interface GetTicketRequest {
  ticketHash: string;
}

export interface GetTicketResponse {
  success: boolean;
  ticket?: {
    ticketHash: string;
    numbers: number[];
    drawId: number;
    purchaseTxId: string;
    createdAt: string;
  };
  error?: string;
}

/**
 * Request to get current draw information
 */
export interface GetDrawRequest {
  drawId?: number;  // Optional: specific draw, defaults to current
}

export interface GetDrawResponse {
  success: boolean;
  draw?: {
    drawId: number;
    status: DrawStatus;
    salesCloseDate: string;
    drawDate: string;
    ticketsSold: number;
    prizePool: number;
    winningNumbers?: number[];  // Only available after draw
    prizesDistributed?: PrizeDistribution;
  };
  error?: string;
}

/**
 * Request to check if numbers are winners
 */
export interface CheckNumbersRequest {
  numbers: number[];
  drawId: number;
}

export interface CheckNumbersResponse {
  success: boolean;
  matches?: number;
  isWinner?: boolean;
  prizeAmount?: number;
  error?: string;
}

/**
 * Request to submit a prize claim
 */
export interface SubmitClaimRequest {
  drawId: number;
  prizeMatches: number;
  nullifier: string;
  zkProof: ZKProof;
  recipientAddress: string;  // Shielded z-address
}

export interface SubmitClaimResponse {
  success: boolean;
  claimId?: string;
  estimatedPayoutTime?: string;
  error?: string;
}

/**
 * Request to get claim status
 */
export interface GetClaimStatusRequest {
  claimId?: string;
  nullifier?: string;
}

export interface GetClaimStatusResponse {
  success: boolean;
  claim?: {
    claimId: string;
    status: ClaimStatus;
    prizeAmount: number;
    payoutTxId?: string;
    claimedAt: string;
    paidOutAt?: string;
  };
  error?: string;
}

// ============================================================================
// ZKP Circuit Types
// ============================================================================

/**
 * Private inputs for ZKP circuit (kept secret by claimer)
 */
export interface ZKPPrivateInputs {
  ticketNumbers: number[];   // The ticket's 6 numbers
  salt: string;              // The ticket's salt
  claimKey: string;          // The secret claim key
  merkleProof: string[];     // Merkle proof that ticket is in registry
  merklePath: number[];      // Path indices for merkle proof
}

/**
 * Public inputs for ZKP circuit (visible to verifier)
 */
export interface ZKPPublicInputs {
  nullifier: string;         // Derived from claim_key
  winningNumbers: number[];  // The 6 winning numbers
  prizeMatches: number;      // Number of matches claimed (3-6)
  ticketSetRoot: string;     // Merkle root of all tickets in draw
  drawId: number;            // Which draw is being claimed
}

// ============================================================================
// Zcash Integration Types
// ============================================================================

/**
 * Zcash transaction information
 */
export interface ZcashTransaction {
  txid: string;
  confirmations: number;
  amount: number;           // Amount in ZEC
  fromAddress?: string;     // Transparent address (if not shielded)
  toAddress: string;
  blockHeight?: number;
  timestamp?: number;
  memo?: string;            // Optional memo for shielded transactions
}

/**
 * Zcash address types
 */
export type ZcashAddressType = 'transparent' | 'shielded';

export interface ZcashAddress {
  address: string;
  type: ZcashAddressType;
  balance?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate number of matching numbers between two arrays
 */
export function countMatches(numbers1: number[], numbers2: number[]): number {
  const set2 = new Set(numbers2);
  return numbers1.filter(n => set2.has(n)).length;
}

/**
 * Validate lottery numbers
 */
export function validateNumbers(numbers: number[]): boolean {
  if (numbers.length !== LOTTERY_CONFIG.NUMBERS_PER_TICKET) {
    return false;
  }

  // Check all numbers are in valid range
  if (!numbers.every(n => n >= LOTTERY_CONFIG.MIN_NUMBER && n <= LOTTERY_CONFIG.MAX_NUMBER)) {
    return false;
  }

  // Check no duplicates
  const uniqueNumbers = new Set(numbers);
  return uniqueNumbers.size === numbers.length;
}

/**
 * Generate random lottery numbers
 */
export function generateRandomNumbers(): number[] {
  const numbers: number[] = [];
  const available = Array.from(
    { length: LOTTERY_CONFIG.MAX_NUMBER },
    (_, i) => i + LOTTERY_CONFIG.MIN_NUMBER
  );

  for (let i = 0; i < LOTTERY_CONFIG.NUMBERS_PER_TICKET; i++) {
    const index = Math.floor(Math.random() * available.length);
    numbers.push(available[index]);
    available.splice(index, 1);
  }

  return numbers.sort((a, b) => a - b);
}

/**
 * Calculate prize amount for a given number of matches
 */
export function calculatePrizeAmount(
  matches: number,
  prizePool: number,
  winnersInTier: number
): number {
  if (matches < LOTTERY_CONFIG.MIN_MATCHES_FOR_PRIZE || matches > LOTTERY_CONFIG.NUMBERS_PER_TICKET) {
    return 0;
  }

  const distributionPool = prizePool * LOTTERY_CONFIG.PRIZE_DISTRIBUTION.PRIZES;
  const tierPercentage = LOTTERY_CONFIG.PRIZE_TIERS[matches as keyof typeof LOTTERY_CONFIG.PRIZE_TIERS];
  const tierPool = distributionPool * tierPercentage;

  return winnersInTier > 0 ? tierPool / winnersInTier : 0;
}
