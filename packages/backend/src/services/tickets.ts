/**
 * Ticket Service
 *
 * Handles ticket purchase, generation, and registration.
 */

import crypto from 'crypto';
import { Database } from '../database';
import { ZcashService } from './zcash';
import { Ticket, LOTTERY_CONFIG, validateNumbers, generateRandomNumbers } from '@zottery/shared';

export class TicketService {
  constructor(
    private db: Database,
    private zcash: ZcashService
  ) { }

  /**
   * Process a ticket purchase
   *
   * This is called after payment is confirmed on the blockchain
   */
  async purchaseTicket(
    txId: string,
    fromAddress: string,
    amount: number,
    numbers?: number[]
  ): Promise<{ ticket: Ticket; claimKey: string }> {
    // Check if ticket already exists for this transaction
    const existing = this.db.getTicketByTxId(txId);
    if (existing) {
      throw new Error('Ticket already created for this transaction');
    }

    // Validate or generate numbers
    let ticketNumbers: number[];
    if (numbers) {
      if (!validateNumbers(numbers)) {
        throw new Error('Invalid lottery numbers');
      }
      ticketNumbers = numbers.sort((a, b) => a - b);
    } else {
      ticketNumbers = generateRandomNumbers();
    }

    // Get current draw
    const currentDraw = this.db.getCurrentDraw();
    if (!currentDraw) {
      throw new Error('No active draw available');
    }

    if (currentDraw.status !== 'open') {
      throw new Error('Current draw is not open for ticket sales');
    }

    // Check if sales have closed
    if (new Date() >= currentDraw.salesCloseDate) {
      throw new Error('Ticket sales have closed for this draw');
    }

    // Generate ticket components
    const salt = this.generateSalt();
    const claimKey = this.generateClaimKey();
    const ticketHash = this.generateTicketHash(ticketNumbers, salt, claimKey);

    // Create ticket
    const ticket: Ticket = {
      ticketHash,
      numbers: ticketNumbers,
      salt,
      drawId: currentDraw.drawId,
      purchaseAmount: amount,
      purchaseTxId: txId,
      createdAt: new Date(),
    };

    // Save to database
    this.db.createTicket(ticket);

    // Update draw statistics
    this.db.updateDraw(currentDraw.drawId, {
      ticketsSold: currentDraw.ticketsSold + 1,
      prizePool: currentDraw.prizePool + amount,
    });

    console.log(`Ticket created: ${ticketHash} for draw ${currentDraw.drawId}`);

    return { ticket, claimKey };
  }

  /**
   * Get ticket by hash
   */
  getTicket(ticketHash: string): Ticket | null {
    return this.db.getTicketByHash(ticketHash);
  }

  /**
   * Get all tickets for a draw
   */
  getTicketsByDraw(drawId: number): Ticket[] {
    return this.db.getTicketsByDraw(drawId);
  }

  /**
   * Process incoming transactions from the blockchain
   *
   * This is called periodically to check for new ticket purchases
   */
  async processIncomingTransactions(): Promise<void> {
    const MIN_CONFIRMATIONS = 1; // Require at least 1 confirmation

    try {
      // Get all received transactions
      const transactions = await this.zcash.getReceivedTransactions(0);

      // Process each transaction
      for (const tx of transactions) {
        // Skip if already processed
        if (this.db.getTicketByTxId(tx.txid)) {
          continue;
        }

        // Check confirmations
        if (tx.confirmations < MIN_CONFIRMATIONS) {
          // Add to pending if not already there
          this.db.addPendingTransaction(tx.txid, tx.fromAddress || '', tx.amount, tx.confirmations);
          continue;
        }

        // Validate amount
        if (tx.amount < LOTTERY_CONFIG.TICKET_PRICE) {
          console.log(`Transaction ${tx.txid} has insufficient amount: ${tx.amount} ZEC`);
          continue;
        }

        try {
          // Parse numbers from memo if present
          const numbers = this.parseMemo(tx.memo);

          // Create ticket
          await this.purchaseTicket(tx.txid, tx.fromAddress || '', tx.amount, numbers);
          console.log(`Processed transaction ${tx.txid} -> ticket created${numbers ? ' with custom numbers' : ''}`);

          // Mark as processed
          this.db.updatePendingTransaction(tx.txid, tx.confirmations, true);
        } catch (error: any) {
          console.error(`Error processing transaction ${tx.txid}:`, error.message);
        }
      }

      // Update confirmation counts for pending transactions
      const pending = this.db.getUnprocessedTransactions();
      for (const ptx of pending) {
        const tx = await this.zcash.getTransaction(ptx.tx_id);
        if (tx && tx.confirmations >= MIN_CONFIRMATIONS) {
          try {
            // We need to re-fetch memo here if it wasn't stored in pending tx
            // But pending tx table might not store memo. 
            // For now, let's assume we can get it from tx again.
            const numbers = this.parseMemo(tx.memo);

            await this.purchaseTicket(ptx.tx_id, ptx.from_address, ptx.amount, numbers);
            this.db.updatePendingTransaction(ptx.tx_id, tx.confirmations, true);
          } catch (error: any) {
            console.error(`Error processing pending transaction ${ptx.tx_id}:`, error.message);
          }
        } else if (tx) {
          this.db.updatePendingTransaction(ptx.tx_id, tx.confirmations, false);
        }
      }
    } catch (error) {
      console.error('Error in processIncomingTransactions:', error);
    }
  }

  /**
   * Parse memo string to extract lottery numbers
   * Format: NUMS:1,2,3,4,5
   */
  private parseMemo(memoHex?: string): number[] | undefined {
    if (!memoHex) return undefined;
    try {
      // Remove 0x prefix if present
      const cleanHex = memoHex.replace(/^0x/, '');

      // Convert hex to string
      let str = '';
      for (let i = 0; i < cleanHex.length; i += 2) {
        const code = parseInt(cleanHex.substr(i, 2), 16);
        if (code === 0) break;
        str += String.fromCharCode(code);
      }

      // Check for NUMS: prefix
      if (str.startsWith('NUMS:')) {
        const numsStr = str.substring(5);
        const nums = numsStr.split(',').map(n => parseInt(n.trim()));

        // Validate numbers
        if (validateNumbers(nums)) {
          return nums;
        } else {
          console.warn(`Invalid numbers in memo: ${numsStr}`);
        }
      }
    } catch (e) {
      console.error('Error parsing memo:', e);
    }
    return undefined;
  }

  /**
   * Verify ticket hash
   */
  verifyTicketHash(
    ticketHash: string,
    numbers: number[],
    salt: string,
    claimKey: string
  ): boolean {
    const computedHash = this.generateTicketHash(numbers, salt, claimKey);
    return computedHash === ticketHash;
  }

  /**
   * Generate ticket hash
   */
  private generateTicketHash(numbers: number[], salt: string, claimKey: string): string {
    const data = JSON.stringify({
      numbers: numbers.sort((a, b) => a - b),
      salt,
      claimKey,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate random salt
   */
  private generateSalt(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate claim key
   */
  private generateClaimKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Calculate merkle root of all tickets in a draw
   * This is used for ZKP verification
   */
  calculateMerkleRoot(drawId: number): string {
    const tickets = this.db.getTicketsByDraw(drawId);

    if (tickets.length === 0) {
      return crypto.createHash('sha256').update('empty').digest('hex');
    }

    // Sort tickets by hash for consistency
    const sortedHashes = tickets
      .map(t => t.ticketHash)
      .sort();

    // Build merkle tree
    let level = sortedHashes;
    while (level.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < level.length; i += 2) {
        if (i + 1 < level.length) {
          // Pair exists
          const combined = level[i] + level[i + 1];
          const hash = crypto.createHash('sha256').update(combined).digest('hex');
          nextLevel.push(hash);
        } else {
          // Odd one out, promote to next level
          nextLevel.push(level[i]);
        }
      }

      level = nextLevel;
    }

    return level[0];
  }

  /**
   * Generate merkle proof for a ticket
   */
  generateMerkleProof(ticketHash: string, drawId: number): { proof: string[]; path: number[] } {
    const tickets = this.db.getTicketsByDraw(drawId);
    const sortedHashes = tickets
      .map(t => t.ticketHash)
      .sort();

    const index = sortedHashes.indexOf(ticketHash);
    if (index === -1) {
      throw new Error('Ticket not found in draw');
    }

    const proof: string[] = [];
    const path: number[] = [];

    let level = sortedHashes;
    let currentIndex = index;

    while (level.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < level.length; i += 2) {
        if (i + 1 < level.length) {
          const combined = level[i] + level[i + 1];
          const hash = crypto.createHash('sha256').update(combined).digest('hex');
          nextLevel.push(hash);

          // If current index is in this pair, add sibling to proof
          if (i === currentIndex) {
            proof.push(level[i + 1]);
            path.push(1); // Sibling is on right
          } else if (i + 1 === currentIndex) {
            proof.push(level[i]);
            path.push(0); // Sibling is on left
          }
        } else {
          nextLevel.push(level[i]);
        }
      }

      currentIndex = Math.floor(currentIndex / 2);
      level = nextLevel;
    }

    return { proof, path };
  }
}
