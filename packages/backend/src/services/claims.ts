/**
 * Claim Service
 *
 * Handles prize claims with zero-knowledge proof verification.
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database';
import { ZcashService } from './zcash';
import { DrawService } from './draws';
import { ZKPService } from './zkp';
import { TicketService } from './tickets';
import { Claim, ZKProof, countMatches } from '@zottery/shared';

export class ClaimService {
  private zkpService: ZKPService;

  constructor(
    private db: Database,
    private zcash: ZcashService,
    private drawService: DrawService,
    private ticketService: TicketService
  ) {
    this.zkpService = new ZKPService();
  }

  /**
   * Initialize the claim service
   */
  async initialize(): Promise<void> {
    await this.zkpService.initialize();
  }

  /**
   * Submit a prize claim
   */
  async submitClaim(
    drawId: number,
    prizeMatches: number,
    nullifier: string,
    zkProof: ZKProof,
    recipientAddress: string
  ): Promise<string> {
    // Validate inputs
    if (prizeMatches < 3 || prizeMatches > 5) {
      throw new Error('Invalid prize matches. Must be between 3 and 5');
    }

    // Check if nullifier already used (double-claim prevention)
    if (this.db.nullifierExists(nullifier)) {
      throw new Error('This ticket has already been claimed');
    }

    // Validate draw exists and is drawable
    const draw = this.db.getDrawById(drawId);
    if (!draw) {
      throw new Error('Draw not found');
    }

    if (draw.status !== 'drawn' && draw.status !== 'completed') {
      throw new Error('Draw has not been executed yet');
    }

    // Validate recipient address
    const addressValidation = await this.zcash.validateAddress(recipientAddress);
    if (!addressValidation.isValid) {
      throw new Error('Invalid recipient address');
    }

    if (!addressValidation.isShielded) {
      throw new Error('Recipient address must be a shielded (z-address)');
    }

    // Verify ZK proof
    const isValid = await this.verifyZkProof(zkProof, {
      drawId,
      prizeMatches,
      nullifier,
      winningNumbers: draw.winningNumbers,
    });

    if (!isValid) {
      throw new Error('Invalid zero-knowledge proof');
    }

    // Get prize amount
    const prizeAmount = this.drawService.getPrizeAmount(drawId, prizeMatches);
    if (prizeAmount <= 0) {
      throw new Error('No prize available for this match count');
    }

    // Create claim
    const claim: Claim = {
      claimId: uuidv4(),
      nullifier,
      drawId,
      prizeMatches,
      prizeAmount,
      zkProof,
      recipientAddress,
      status: 'verified',
      claimedAt: new Date(),
    };

    this.db.createClaim(claim);

    console.log(`Claim submitted: ${claim.claimId} for draw ${drawId}, ${prizeMatches} matches, ${prizeAmount} ZEC`);

    return claim.claimId;
  }

  /**
   * Get claim by ID
   */
  getClaim(claimId: string): Claim | null {
    return this.db.getClaimById(claimId);
  }

  /**
   * Get claim by nullifier
   */
  getClaimByNullifier(nullifier: string): Claim | null {
    return this.db.getClaimByNullifier(nullifier);
  }

  /**
   * Get all claims for a draw
   */
  getClaimsByDraw(drawId: number): Claim[] {
    return this.db.getClaimsByDraw(drawId);
  }

  /**
   * Process pending claims (pay out verified claims)
   */
  async processPendingClaims(): Promise<void> {
    const pendingClaims = this.db.getPendingClaims(5); // Process 5 at a time

    for (const claim of pendingClaims) {
      try {
        await this.payoutClaim(claim.claimId);
      } catch (error: any) {
        console.error(`Error paying out claim ${claim.claimId}:`, error.message);

        // If error is critical, reject the claim
        if (error.message.includes('insufficient funds') || error.message.includes('invalid address')) {
          this.db.updateClaim(claim.claimId, { status: 'rejected' });
        }
      }
    }
  }

  /**
   * Pay out a claim
   */
  private async payoutClaim(claimId: string): Promise<void> {
    const claim = this.db.getClaimById(claimId);
    if (!claim) {
      throw new Error('Claim not found');
    }

    if (claim.status !== 'verified') {
      throw new Error('Claim is not in verified status');
    }

    console.log(`Paying out claim ${claimId}: ${claim.prizeAmount} ZEC to ${claim.recipientAddress}`);

    // Send ZEC to shielded address
    const txId = await this.zcash.sendToShieldedAddress(
      claim.recipientAddress,
      claim.prizeAmount,
      `Zottery Prize - Draw ${claim.drawId} - ${claim.prizeMatches} matches`
    );

    // Update claim
    this.db.updateClaim(claimId, {
      status: 'paid',
      payoutTxId: txId,
      paidOutAt: new Date(),
    });

    console.log(`Claim ${claimId} paid out successfully. TX: ${txId}`);
  }

  /**
   * Verify zero-knowledge proof
   *
   * Uses snarkjs to verify the ZK-SNARK proof cryptographically.
   */
  private async verifyZkProof(
    zkProof: ZKProof,
    publicInputs: {
      drawId: number;
      prizeMatches: number;
      nullifier: string;
      winningNumbers: number[];
    }
  ): Promise<boolean> {
    try {
      // Validate proof structure first
      if (!this.zkpService.validateProofStructure(zkProof)) {
        console.error('Invalid proof structure');
        return false;
      }

      // Get Merkle root of all tickets in this draw
      const ticketTreeRoot = this.ticketService.calculateMerkleRoot(publicInputs.drawId);

      // Verify proof using ZKP service
      const isValid = await this.zkpService.verifyClaimProof(zkProof, {
        nullifier: publicInputs.nullifier,
        winningNumbers: publicInputs.winningNumbers,
        minMatches: publicInputs.prizeMatches,
        ticketTreeRoot,
        drawId: publicInputs.drawId,
      });

      if (isValid) {
        const status = this.zkpService.getStatus();
        console.log(`✅ ZK proof verified successfully (mode: ${status.mode})`);
      } else {
        console.error('❌ ZK proof verification failed');
      }

      return isValid;
    } catch (error) {
      console.error('Error verifying ZK proof:', error);
      return false;
    }
  }

  /**
   * Hash a string to a field element (for ZK circuits)
   */
  private hashToField(input: string): string {
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    // Convert to bigint and mod with field size (BN254 field)
    const fieldSize = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    const value = BigInt('0x' + hash) % fieldSize;
    return value.toString();
  }

  /**
   * Generate nullifier from claim key
   *
   * Nullifier = hash(claimKey)
   * This is what prevents double-claiming
   */
  generateNullifier(claimKey: string): string {
    return crypto.createHash('sha256').update(claimKey).digest('hex');
  }

  /**
   * Verify a ticket can claim a prize (without ZKP)
   *
   * This is a helper function for testing/development
   */
  verifyTicketCanClaim(
    ticketNumbers: number[],
    salt: string,
    claimKey: string,
    drawId: number
  ): { canClaim: boolean; matches: number; prizeAmount: number } {
    // Get ticket hash
    const ticketHash = crypto.createHash('sha256')
      .update(JSON.stringify({
        numbers: ticketNumbers.sort((a, b) => a - b),
        salt,
        claimKey,
      }))
      .digest('hex');

    // Check ticket exists
    const ticket = this.db.getTicketByHash(ticketHash);
    if (!ticket) {
      return { canClaim: false, matches: 0, prizeAmount: 0 };
    }

    // Check ticket is for correct draw
    if (ticket.drawId !== drawId) {
      return { canClaim: false, matches: 0, prizeAmount: 0 };
    }

    // Get draw
    const draw = this.db.getDrawById(drawId);
    if (!draw || draw.status !== 'drawn') {
      return { canClaim: false, matches: 0, prizeAmount: 0 };
    }

    // Check matches
    const matches = countMatches(ticketNumbers, draw.winningNumbers);
    if (matches < 3) {
      return { canClaim: false, matches, prizeAmount: 0 };
    }

    // Check if already claimed
    const nullifier = this.generateNullifier(claimKey);
    if (this.db.nullifierExists(nullifier)) {
      return { canClaim: false, matches, prizeAmount: 0 };
    }

    // Get prize amount
    const prizeAmount = this.drawService.getPrizeAmount(drawId, matches);

    return {
      canClaim: true,
      matches,
      prizeAmount,
    };
  }
}
