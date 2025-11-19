/**
 * Draw Service
 *
 * Handles lottery draws, winning number generation, and prize calculation.
 */

import crypto from 'crypto';
import { Database } from '../database';
import {
  Draw,
  LOTTERY_CONFIG,
  generateRandomNumbers,
  countMatches,
  calculatePrizeAmount,
  PrizeDistribution,
} from '@zottery/shared';

export class DrawService {
  constructor(private db: Database) { }

  /**
   * Create a new draw
   */
  createDraw(salesCloseDate: Date, drawDate: Date): number {
    const draw: Omit<Draw, 'drawId'> = {
      winningNumbers: [],
      drawDate,
      salesCloseDate,
      ticketsSold: 0,
      prizePool: 0,
      status: 'open',
      prizesDistributed: {
        match5: { winners: 0, amountEach: 0 },
        match4: { winners: 0, amountEach: 0 },
        match3: { winners: 0, amountEach: 0 },
      },
    };

    const drawId = this.db.createDraw(draw);
    console.log(`Created new draw ${drawId}, closes at ${salesCloseDate.toISOString()}`);

    return drawId;
  }

  /**
   * Get draw by ID
   */
  getDraw(drawId: number): Draw | null {
    return this.db.getDrawById(drawId);
  }

  /**
   * Get current active draw
   */
  getCurrentDraw(): Draw | null {
    return this.db.getCurrentDraw();
  }

  /**
   * Get all draws
   */
  getAllDraws(limit: number = 10, offset: number = 0): Draw[] {
    return this.db.getAllDraws(limit, offset);
  }

  /**
   * Execute a draw (generate winning numbers)
   */
  async executeDraw(drawId: number): Promise<Draw> {
    const draw = this.db.getDrawById(drawId);
    if (!draw) {
      throw new Error('Draw not found');
    }

    if (draw.status !== 'open' && draw.status !== 'closed') {
      throw new Error(`Cannot execute draw in status: ${draw.status}`);
    }

    // Close ticket sales if not already closed
    if (draw.status === 'open') {
      this.db.updateDraw(drawId, { status: 'closed' });
    }

    // Generate winning numbers with VRF
    const { numbers, proof } = this.generateWinningNumbers(drawId);

    // Update draw
    this.db.updateDraw(drawId, {
      winningNumbers: numbers,
      vrfProof: proof,
      status: 'drawn',
    });

    // Calculate prize distribution
    await this.calculatePrizeDistribution(drawId);

    const updatedDraw = this.db.getDrawById(drawId);
    if (!updatedDraw) {
      throw new Error('Failed to get updated draw');
    }

    console.log(`Draw ${drawId} executed. Winning numbers: ${numbers.join(', ')}`);

    return updatedDraw;
  }

  /**
   * Calculate prize distribution based on winning tickets
   */
  private async calculatePrizeDistribution(drawId: number): Promise<void> {
    const draw = this.db.getDrawById(drawId);
    if (!draw) {
      throw new Error('Draw not found');
    }

    const tickets = this.db.getTicketsByDraw(drawId);

    // Count winners for each tier
    const winnerCounts = {
      match5: 0,
      match4: 0,
      match3: 0,
    };

    for (const ticket of tickets) {
      const matches = countMatches(ticket.numbers, draw.winningNumbers);

      if (matches === 5) winnerCounts.match5++;
      else if (matches === 4) winnerCounts.match4++;
      else if (matches === 3) winnerCounts.match3++;
    }

    // Calculate prize amounts
    const prizePool = draw.prizePool * LOTTERY_CONFIG.PRIZE_DISTRIBUTION.PRIZES;

    const prizesDistributed: PrizeDistribution = {
      match6: { winners: 0, amountEach: 0 }, // Legacy/Unused
      match5: {
        winners: winnerCounts.match5,
        amountEach: calculatePrizeAmount(5, draw.prizePool, winnerCounts.match5),
      },
      match4: {
        winners: winnerCounts.match4,
        amountEach: calculatePrizeAmount(4, draw.prizePool, winnerCounts.match4),
      },
      match3: {
        winners: winnerCounts.match3,
        amountEach: calculatePrizeAmount(3, draw.prizePool, winnerCounts.match3),
      },
    };

    // Update draw
    this.db.updateDraw(drawId, { prizesDistributed });

    console.log(`Prize distribution calculated for draw ${drawId}:`, prizesDistributed);
  }

  /**
   * Generate winning numbers with verifiable randomness
   *
   * In production, this should use a VRF (Verifiable Random Function)
   * like Chainlink VRF for provably fair randomness.
   *
   * For now, we use crypto.randomBytes with a commitment scheme.
   */
  private generateWinningNumbers(drawId: number): { numbers: number[]; proof: string } {
    // Create commitment
    const seed = crypto.randomBytes(32);
    const commitment = crypto.createHash('sha256').update(seed).digest('hex');

    // Generate numbers from seed
    const numbers = this.numbersFromSeed(seed);

    // Create proof (commitment + seed)
    const proof = JSON.stringify({
      commitment,
      seed: seed.toString('hex'),
      drawId,
      timestamp: new Date().toISOString(),
    });

    return { numbers, proof };
  }

  /**
   * Generate lottery numbers from a seed
   */
  private numbersFromSeed(seed: Buffer): number[] {
    const numbers: number[] = [];
    const available = Array.from(
      { length: LOTTERY_CONFIG.MAX_NUMBER },
      (_, i) => i + LOTTERY_CONFIG.MIN_NUMBER
    );

    let hash = seed;

    for (let i = 0; i < LOTTERY_CONFIG.NUMBERS_PER_TICKET; i++) {
      // Use hash to pick a number
      hash = crypto.createHash('sha256').update(hash).digest();
      const value = hash.readUInt32BE(0);
      const index = value % available.length;

      numbers.push(available[index]);
      available.splice(index, 1);
    }

    return numbers.sort((a, b) => a - b);
  }

  /**
   * Verify VRF proof
   */
  verifyVrfProof(proof: string, winningNumbers: number[]): boolean {
    try {
      const { commitment, seed, drawId } = JSON.parse(proof);

      // Verify commitment
      const seedBuffer = Buffer.from(seed, 'hex');
      const computedCommitment = crypto.createHash('sha256').update(seedBuffer).digest('hex');

      if (computedCommitment !== commitment) {
        return false;
      }

      // Verify numbers
      const computedNumbers = this.numbersFromSeed(seedBuffer);
      return JSON.stringify(computedNumbers) === JSON.stringify(winningNumbers);
    } catch (error) {
      console.error('Error verifying VRF proof:', error);
      return false;
    }
  }

  /**
   * Check if a draw needs to be executed
   */
  async checkAndExecutePendingDraws(): Promise<void> {
    const currentDraw = this.db.getCurrentDraw();
    if (!currentDraw) {
      // No active draw, create one
      const now = new Date();
      const salesClose = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const drawDate = new Date(salesClose.getTime() + 60 * 60 * 1000); // 1 hour after close

      this.createDraw(salesClose, drawDate);
      return;
    }

    // Check if sales should be closed
    if (currentDraw.status === 'open' && new Date() >= currentDraw.salesCloseDate) {
      console.log(`Closing ticket sales for draw ${currentDraw.drawId}`);
      this.db.updateDraw(currentDraw.drawId, { status: 'closed' });
    }

    // Check if draw should be executed
    if (currentDraw.status === 'closed' && new Date() >= currentDraw.drawDate) {
      console.log(`Executing draw ${currentDraw.drawId}`);
      await this.executeDraw(currentDraw.drawId);

      // Create next draw
      const now = new Date();
      const salesClose = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const drawDate = new Date(salesClose.getTime() + 60 * 60 * 1000);

      this.createDraw(salesClose, drawDate);
    }
  }

  /**
   * Check if numbers are winners
   */
  checkNumbers(numbers: number[], drawId: number): { matches: number; prizeAmount: number } {
    const draw = this.db.getDrawById(drawId);
    if (!draw) {
      throw new Error('Draw not found');
    }

    if (draw.status !== 'drawn' && draw.status !== 'completed') {
      throw new Error('Draw has not been executed yet');
    }

    const matches = countMatches(numbers, draw.winningNumbers);

    let prizeAmount = 0;
    if (matches === 5) {
      prizeAmount = draw.prizesDistributed.match5.amountEach;
    } else if (matches === 4) {
      prizeAmount = draw.prizesDistributed.match4.amountEach;
    } else if (matches === 3) {
      prizeAmount = draw.prizesDistributed.match3.amountEach;
    }

    return { matches, prizeAmount };
  }

  /**
   * Get prize amount for a given number of matches
   */
  getPrizeAmount(drawId: number, matches: number): number {
    const draw = this.db.getDrawById(drawId);
    if (!draw) {
      throw new Error('Draw not found');
    }

    if (matches === 5) return draw.prizesDistributed.match5.amountEach;
    if (matches === 4) return draw.prizesDistributed.match4.amountEach;
    if (matches === 3) return draw.prizesDistributed.match3.amountEach;

    return 0;
  }
}
