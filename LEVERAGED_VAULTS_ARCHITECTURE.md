# Leveraged Lottery Vaults Architecture

## Overview

Leveraged Lottery Vaults combine DeFi yield strategies on Starknet with privacy-preserving prize claims on Zcash. Users deposit collateral, the vault takes leveraged positions, and winners claim prizes anonymously via cross-chain messaging.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            USER                                      │
│  (Starknet Wallet + Zcash z-address)                               │
└───────────────────┬─────────────────────────────────────────────────┘
                    │
        ┌───────────▼──────────────┐
        │  DEPOSIT COLLATERAL      │
        │  (USDC/ETH on Starknet)  │
        └───────────┬──────────────┘
                    │
    ┌───────────────▼────────────────────┐
    │     STARKNET SMART CONTRACTS       │
    ├────────────────────────────────────┤
    │  1. LeveragedVault.cairo          │
    │     - Accept deposits              │
    │     - Take leveraged positions     │
    │     - Generate yield               │
    │                                    │
    │  2. LotteryManager.cairo          │
    │     - Issue tickets (commitments)  │
    │     - Execute draws (VRF)          │
    │     - Track prize pools            │
    │                                    │
    │  3. ClaimVerifier.cairo           │
    │     - Verify ZK proofs             │
    │     - Check nullifiers             │
    │     - Emit payout events           │
    └────────────────┬───────────────────┘
                     │
         ┌───────────▼──────────────┐
         │   CROSS-CHAIN RELAYER    │
         │   (Off-chain Service)    │
         ├──────────────────────────┤
         │  - Listen to Starknet    │
         │  - Verify proofs         │
         │  - Trigger Zcash payouts │
         │  - Multi-sig (optional)  │
         └───────────┬──────────────┘
                     │
         ┌───────────▼──────────────┐
         │   ZCASH NETWORK          │
         │   (Shielded Payouts)     │
         ├──────────────────────────┤
         │  - Receive from relayer  │
         │  - Pay to z-address      │
         │  - Full privacy          │
         └──────────────────────────┘
```

## Key Components

### 1. Starknet Smart Contracts

#### LeveragedVault.cairo
- **Purpose:** Manages user deposits and leveraged positions
- **Functions:**
  - `deposit(amount: u256)` - Accept USDC/ETH deposits
  - `set_leverage(multiplier: u8)` - Set leverage (1x-10x)
  - `execute_strategy()` - Deploy capital to DeFi protocols
  - `calculate_yield()` - Track vault performance
  - `withdraw(amount: u256)` - Allow withdrawals (with conditions)

#### LotteryManager.cairo
- **Purpose:** Handles lottery mechanics on Starknet
- **Functions:**
  - `generate_ticket_commitment(user: Address, salt: felt252) -> felt252`
  - `execute_draw(draw_id: u64)` - VRF-based draw execution
  - `get_winning_numbers() -> Array<u8>`
  - `calculate_prize_pool() -> u256`

#### ClaimVerifier.cairo
- **Purpose:** Verifies ZK proofs and authorizes payouts
- **Functions:**
  - `verify_claim_proof(proof: Proof, public_inputs: Array<felt252>) -> bool`
  - `claim_prize(proof: Proof, nullifier: felt252, z_address_hash: felt252)`
  - `emit PayoutAuthorized(nullifier, amount, timestamp)`

### 2. Zero-Knowledge Circuits

#### New Circuit: `starknetClaimVerifier.circom`
Proves winner ownership without revealing identity across chains.

**Public Inputs:**
- `winning_commitment` - The commitment selected by Starknet VRF
- `nullifier` - Prevents double-claiming
- `draw_id` - Links claim to specific draw
- `z_address_hash` - Hash of recipient Zcash address

**Private Inputs:**
- `ticket_id` - User's ticket identifier
- `secret_salt` - Random salt for commitment
- `z_address_preimage` - Actual Zcash z-address

**Constraints:**
1. Verify commitment: `poseidon_hash([ticket_id, secret_salt]) == winning_commitment`
2. Verify nullifier: `poseidon_hash([ticket_id, draw_id]) == nullifier`
3. Verify z-address hash: `poseidon_hash([z_address_preimage]) == z_address_hash`

### 3. Cross-Chain Relayer

#### Architecture
```typescript
class CrossChainRelayer {
  // Services
  private starknetProvider: Provider;
  private zcashRPC: ZcashRPC;
  private zkpVerifier: ZKPVerifier;

  // Main loop
  async start() {
    // Listen to Starknet events
    this.listenToPayoutEvents();
  }

  // Event handlers
  async onPayoutAuthorized(event: PayoutAuthorizedEvent) {
    // 1. Fetch winner's encrypted z-address
    // 2. Verify ZK proof independently
    // 3. Send Zcash shielded transaction
    // 4. Report back to Starknet
  }
}
```

#### Security Model

**V1 - Centralized Relayer:**
- Single trusted relayer
- Fast and simple
- Suitable for MVP/testnet

**V2 - Multi-Sig Relayer Network:**
- 5 independent relayers
- 3/5 threshold signature required
- More decentralized
- Uses MPC for Zcash key management

### 4. DeFi Integration

#### Supported Strategies (Phase 1)

1. **Starknet DeFi Protocols:**
   - **Jediswap** - DEX liquidity provision
   - **zkLend** - Lending/borrowing for leverage
   - **Nostra Finance** - Money markets
   - **Ekubo** - Concentrated liquidity

2. **Leverage Mechanism:**
```
User deposits 1000 USDC
→ Vault borrows 4000 USDC from zkLend (5x leverage)
→ Total 5000 USDC deployed to strategies
→ Yield accrues to vault
→ Prize pool grows from yield
```

3. **Risk Management:**
   - Maximum leverage: 10x
   - Liquidation threshold: 80% LTV
   - Auto-deleverage on market stress
   - Insurance fund from protocol fees

## Data Flow

### Deposit → Ticket Generation
```
1. User calls vault.deposit(1000 USDC) on Starknet
2. Vault mints receipt token
3. Off-chain: User generates secret salt
4. Off-chain: User computes commitment = poseidon_hash([user_address, salt])
5. User calls lottery.register_ticket(commitment)
6. Starknet stores commitment in merkle tree
7. User gets: ticket_id, needs to save: salt (secret)
```

### Draw Execution
```
1. Cron job calls lottery.execute_draw(draw_id)
2. Contract calls Starknet VRF (randomness oracle)
3. VRF returns verifiable random number
4. Contract selects winning commitment from merkle tree
5. Event emitted: DrawExecuted(draw_id, winning_commitment, prize_pool)
6. Frontend shows winning commitment (public)
```

### Claim → Cross-Chain Payout
```
1. Winner generates ZK proof off-chain (browser)
   - Inputs: ticket_id, salt, z_address
   - Proof: "I own winning commitment and want payout to z_address"

2. Winner calls claim_verifier.claim_prize(proof, nullifier, z_address_hash)

3. Starknet contract verifies proof
   - Check proof validity
   - Check nullifier not used
   - Mark nullifier as used

4. Starknet emits: PayoutAuthorized(nullifier, amount, z_address_hash)

5. Relayer detects event
   - Fetches encrypted z_address from winner (off-chain channel)
   - Decrypts using relayer's key
   - Verifies z_address_hash matches

6. Relayer sends Zcash transaction
   - From: Vault's z-address (shielded pool)
   - To: Winner's z-address
   - Amount: Prize amount
   - Memo: Empty (no identifying info)

7. Relayer reports back to Starknet
   - Call: lottery.record_payout(nullifier, zcash_tx_hash)
   - Completes audit trail
```

## Privacy Guarantees

### What's Public
- Starknet deposits (addresses and amounts)
- Ticket commitments (hashes only)
- Winning commitment (hash only)
- Draw results and prize pool
- That *someone* claimed a prize

### What's Private
- **Link between depositor and winner** (broken by commitments)
- **Winner's actual identity** (ZK proof doesn't reveal)
- **Winner's Zcash address** (shielded transaction)
- **Prize amount on Zcash** (shielded transaction)
- **When winner claims on Zcash** (timing decorrelation)

### Anonymity Set
- All ticket holders in a draw are indistinguishable
- Even relayer can't link Starknet address to z-address
- Zcash network can't see source (shielded pool)

## Economic Model

### Fee Structure
- **Deposit fee:** 1% (goes to prize pool)
- **Performance fee:** 10% of yield (protocol revenue)
- **Relayer fee:** 0.1% of payout (covers gas)
- **Winner receives:** Prize pool - relayer fee

### Prize Pool Growth
```
Prize Pool = Base Deposits + Leveraged Yield + Rollover

Example:
- 100 users deposit 1000 USDC each = 100,000 USDC
- Vault takes 5x leverage = 500,000 USDC trading power
- Vault earns 10% APY on 500,000 = 50,000 USDC/year
- After 10% performance fee = 45,000 USDC to prize pool
- Monthly prize pool = 3,750 USDC (from yield alone)
```

### Ticket Allocation
- 1 ticket per 100 USDC deposited
- Max tickets per user: 100 (prevent whale dominance)
- Tickets valid for: Next 30 days
- Auto-renewal if funds remain deposited

## Technical Stack

### Starknet Layer
- **Language:** Cairo 2.5+
- **Testing:** starknet-foundry
- **Deployment:** Starknet mainnet / Sepolia testnet
- **VRF:** Pragma Oracle or Starknet native VRF

### Relayer Layer
- **Language:** TypeScript/Node.js
- **Starknet SDK:** starknet.js
- **Zcash RPC:** zcash-cli wrapper
- **Database:** PostgreSQL (event tracking)
- **Queue:** Redis (job processing)

### Frontend
- **Wallet:** Starknet React + get-starknet
- **Supported Wallets:** ArgentX, Braavos
- **ZK Proving:** snarkjs (browser-based)
- **State Management:** React Context + TanStack Query

## Deployment Plan

### Phase 1: MVP (Testnet)
- [ ] Deploy contracts to Starknet Sepolia
- [ ] Single centralized relayer
- [ ] Basic vault strategy (single protocol)
- [ ] 2x max leverage
- [ ] Manual draw execution

### Phase 2: Beta (Mainnet)
- [ ] Deploy to Starknet mainnet
- [ ] Multi-sig relayer (3/5)
- [ ] Multiple vault strategies
- [ ] 5x max leverage
- [ ] Automated draws (daily)

### Phase 3: Production
- [ ] Full decentralization (5/7 relayers)
- [ ] Advanced strategies (multiple protocols)
- [ ] 10x max leverage
- [ ] Multiple vaults (risk profiles)
- [ ] Governance token

## Security Considerations

### Smart Contract Risks
- **Reentrancy:** Use checks-effects-interactions pattern
- **Oracle manipulation:** Use time-weighted average prices
- **VRF bias:** Verify VRF proofs on-chain
- **Liquidation cascades:** Implement circuit breakers

### Relayer Risks
- **Relayer goes offline:** Multi-sig with fallback relayers
- **Relayer censors winners:** Proof of censorship, slash bond
- **Relayer steals funds:** Multi-sig prevents unilateral control
- **Communication channel attack:** Encrypt z-address with winner's key

### ZK Circuit Risks
- **Trusted setup compromise:** Use Powers of Tau ceremony
- **Circuit bugs:** Formal verification + extensive testing
- **Proof forgery:** Use battle-tested Groth16/PLONK

## Monitoring & Operations

### Metrics to Track
- Total Value Locked (TVL)
- Leverage ratio
- Vault performance (APY)
- Prize pool size
- Number of active tickets
- Claim success rate
- Relayer uptime

### Alerts
- Liquidation threshold approaching
- VRF oracle failure
- Relayer offline > 5 minutes
- Unusual claim patterns
- Smart contract paused

## Future Enhancements

### Additional Features
1. **Multiple risk vaults:** Conservative (2x) / Moderate (5x) / Aggressive (10x)
2. **Strategy voting:** Token holders vote on DeFi strategies
3. **NFT tickets:** Tradable lottery positions
4. **Yield auto-compounding:** Reinvest yield for bigger prizes
5. **Cross-chain expansion:** Bridge to other L2s (Arbitrum, Optimism)

### Advanced Privacy
1. **Stealth addresses:** Generate new z-address per claim
2. **Decoy transactions:** Send multiple Zcash txs to mask winner
3. **Timing obfuscation:** Random delay before payout
4. **Amount obfuscation:** Split payout across multiple txs

---

## Getting Started

See [LEVERAGED_VAULTS_SETUP.md](./LEVERAGED_VAULTS_SETUP.md) for deployment instructions.

## Questions?

- Architecture questions: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- ZKP questions: See [ZKP_SETUP.md](./ZKP_SETUP.md)
- Starknet questions: https://docs.starknet.io
- Zcash questions: https://z.cash/
