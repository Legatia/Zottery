# Zottery - Anonymous Lottery System Architecture

## Overview

Zottery is an anonymous lottery system leveraging Zcash for privacy-preserving prize claims. Users can participate in lottery draws using traditional lottery numbers while maintaining complete anonymity during prize redemption through zero-knowledge proofs.

## Core Concept

### The Problem
Traditional lotteries require winners to publicly reveal their identity to claim prizes, creating privacy and security concerns for large prize winners.

### Our Solution
- **Public Participation**: Transparent ticket purchases and number selection
- **Anonymous Claiming**: Zero-knowledge proofs allow winners to claim prizes without revealing their identity or which ticket won
- **Zcash Privacy**: All prize distributions occur through Zcash shielded addresses

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  - Ticket Purchase UI                                        │
│  - Number Selection                                          │
│  - Prize Checking                                            │
│  - ZKP Generation (Client-side)                              │
│  - Claim Submission                                          │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP/WebSocket
┌────────────────▼────────────────────────────────────────────┐
│                    Backend (Node.js + TypeScript)            │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ API Layer                                            │    │
│  │ - Ticket Purchase                                    │    │
│  │ - Ticket Query                                       │    │
│  │ - Draw Status                                        │    │
│  │ - Claim Submission                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Business Logic                                       │    │
│  │ - Ticket Registry                                    │    │
│  │ - Draw Management                                    │    │
│  │ - ZKP Verification                                   │    │
│  │ - Prize Calculation                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Zcash Integration                                    │    │
│  │ - Transaction Monitoring                             │    │
│  │ - Address Generation                                 │    │
│  │ - Prize Distribution                                 │    │
│  └─────────────────────────────────────────────────────┘    │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│                    Data Layer                                │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ Ticket Database  │  │ Nullifier Set    │                 │
│  │ - Ticket Hashes  │  │ - Claimed Tickets│                 │
│  │ - Numbers        │  │ - Double-spend   │                 │
│  │ - Metadata       │  │   Prevention     │                 │
│  └──────────────────┘  └──────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│                    Zcash Blockchain                          │
│                                                               │
│  Transparent Pool          Shielded Pool                     │
│  - Ticket Purchases   →    - Prize Pool                      │
│  - Observable              - Anonymous Claims                │
│                            - Private Recipients              │
└─────────────────────────────────────────────────────────────┘
```

## Lottery Mechanics

### 1. Ticket Purchase Flow

```
1. User selects 6 numbers (1-49) or gets random numbers
2. User sends ZEC to lottery transparent address
3. Backend detects payment and generates:
   - Random salt
   - Claim key (private key for this ticket)
   - Ticket hash = SHA256(numbers || salt || claim_key)
4. Backend stores: ticket_hash → {numbers, salt, draw_id}
5. User receives: {ticket_hash, numbers, salt, claim_key}
   ⚠️ User must save claim_key securely (lost = cannot claim)
```

### 2. Draw Process

```
1. Ticket sales close at predetermined time
2. Verifiable Random Function (VRF) generates 6 winning numbers
3. Winning numbers published on-chain and to frontend
4. Prize tiers calculated:
   - 6/6 matches: Grand Prize (60% of pool)
   - 5/6 matches: Second Prize (20% of pool)
   - 4/6 matches: Third Prize (15% of pool)
   - 3/6 matches: Consolation (5% of pool)
```

### 3. Anonymous Claim Flow

```
1. User checks their numbers against winning numbers (client-side)
2. If winner, user generates Zero-Knowledge Proof locally:

   Proof proves:
   "I know (numbers, salt, claim_key) such that:
    ✓ hash(numbers, salt, claim_key) is in the ticket registry
    ✓ numbers match X/6 winning numbers
    ✓ nullifier = hash(claim_key) has not been used
    ✓ WITHOUT revealing which ticket or my identity"

3. User submits:
   - ZK Proof
   - Nullifier (derived from claim_key)
   - Shielded Zcash address (z-address)
   - Prize tier claimed

4. Backend verifies:
   - Proof is valid
   - Nullifier not in claimed set
   - Prize tier matches proof

5. If valid:
   - Add nullifier to claimed set
   - Send prize to shielded address
   - Winner remains anonymous!
```

## Technical Components

### Zero-Knowledge Proof Circuit

We use **circom** + **snarkjs** for ZKP generation and verification.

**Circuit Logic:**
```circom
template ClaimVerifier() {
    // Public inputs
    signal input nullifier;
    signal input winningNumbers[6];
    signal input prizeMatches; // How many matches claimed (3-6)
    signal input ticketSetRoot; // Merkle root of all tickets

    // Private inputs
    signal input ticketNumbers[6];
    signal input salt;
    signal input claimKey;
    signal input merkleProof[...]; // Proof ticket is in set

    // Verify ticket hash is in registry (Merkle proof)
    component ticketHash = HashTicket();
    ticketHash.numbers <== ticketNumbers;
    ticketHash.salt <== salt;
    ticketHash.claimKey <== claimKey;

    component merkleVerify = MerkleVerify();
    merkleVerify.leaf <== ticketHash.out;
    merkleVerify.proof <== merkleProof;
    merkleVerify.root === ticketSetRoot;

    // Verify nullifier derived correctly
    component nullifierCalc = Poseidon(1);
    nullifierCalc.inputs[0] <== claimKey;
    nullifierCalc.out === nullifier;

    // Count matches
    component matchCounter = CountMatches();
    matchCounter.ticketNumbers <== ticketNumbers;
    matchCounter.winningNumbers <== winningNumbers;
    matchCounter.matchCount === prizeMatches;
}
```

### Data Models

**Ticket Registry:**
```typescript
interface Ticket {
  ticketHash: string;        // SHA256(numbers || salt || claim_key)
  numbers: number[];         // [1-49, 1-49, 1-49, 1-49, 1-49, 1-49]
  salt: string;              // Random bytes
  drawId: number;            // Which draw this ticket is for
  purchaseAmount: number;    // ZEC paid
  purchaseTxId: string;      // Zcash transaction ID
  createdAt: Date;
}
```

**Draw:**
```typescript
interface Draw {
  drawId: number;
  winningNumbers: number[];  // [1-49, 1-49, 1-49, 1-49, 1-49, 1-49]
  drawDate: Date;
  ticketsSold: number;
  prizePool: number;         // Total ZEC in pool
  vrfProof: string;          // Verifiable randomness proof
  status: 'open' | 'drawn' | 'paid_out';
}
```

**Claim Record:**
```typescript
interface Claim {
  nullifier: string;         // Unique per claim_key (prevents double-spend)
  drawId: number;
  prizeMatches: number;      // 3, 4, 5, or 6
  prizeAmount: number;       // ZEC paid
  zkProof: string;           // Serialized ZK proof
  recipientAddress: string;  // Shielded z-address
  payoutTxId: string;        // Zcash transaction ID
  claimedAt: Date;
}
```

## Security Considerations

### 1. Double-Claim Prevention
- Nullifier set prevents same ticket from claiming twice
- Nullifier = hash(claim_key) is unique per ticket
- Once used, nullifier is permanently recorded

### 2. Verifiable Randomness
- Use Chainlink VRF or commit-reveal scheme
- Draw results must be provably random and tamper-proof
- VRF proof published with winning numbers

### 3. Privacy Guarantees
- **Ticket Purchase**: Public (on transparent blockchain)
- **Ticket Ownership**: Private (only holder knows claim_key)
- **Claim Action**: Anonymous (ZKP hides which ticket)
- **Prize Receipt**: Private (shielded address)

### 4. Trust Minimization
- All ticket hashes published (verifiable registry)
- Draw results published on-chain
- Open-source client for local verification
- Multi-sig treasury for prize pool funds

## Prize Distribution

**Prize Pool Breakdown:**
- 75% → Prize distribution
- 20% → Next draw rollover
- 5% → Operations

**Prize Tiers (of 75% pool):**
- 6/6 matches: 60% (Grand Prize)
- 5/6 matches: 20% (Second Prize)
- 4/6 matches: 15% (Third Prize)
- 3/6 matches: 5% (Consolation)

If multiple winners in a tier, prize is split equally.

## Deployment Architecture

### Development
- Backend: Node.js Express server
- Frontend: React dev server
- Database: SQLite
- Zcash: Testnet (TAZ)

### Production
- Backend: Docker container on cloud VM
- Frontend: Static hosting (Vercel/Netlify)
- Database: PostgreSQL
- Zcash: Mainnet with dedicated node
- Load balancer + CDN

## Future Enhancements

1. **Multiple Draw Types**: Daily, weekly, jackpot rollovers
2. **Ticket Bundles**: Buy multiple tickets in one transaction
3. **Syndicate Play**: Group ticket purchases with shared claiming
4. **Mobile App**: Native iOS/Android with local ZKP generation
5. **DAO Governance**: Community-controlled parameters
6. **Cross-chain**: Bridge to other privacy chains

## Privacy Analysis

**What's Public:**
- Total tickets sold
- Prize pool size
- Winning numbers
- Number of winners per tier

**What's Private:**
- Who owns which ticket
- Who claimed which prize
- Prize recipient identity
- Recipient wallet balance

**Anonymity Set:** Each winner's anonymity set = all tickets with matching numbers. Even if only one 6/6 winner, they're hidden among all ticket holders.
